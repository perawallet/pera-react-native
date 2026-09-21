/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import {
    useCardPendingWithdrawalQuery,
    useCardStore,
    useEscrowWithdrawal,
    type PendingWithdrawal,
} from '@perawallet/wallet-core-card'
import {
    getOnChainAccountInformationQueryKey,
    invalidateAccountQueriesForAddresses,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId, useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useMinimumFeeCalculator } from '@perawallet/wallet-core-signing'
import {
    assertOnline,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useQueryClient } from '@tanstack/react-query'
import { USDC_FALLBACK_DECIMALS } from '../utils/usdc'
import { CardEscrowUnavailableError } from './useCardManualDeposit'
import { useCardOwnerAccount } from './useCardOwnerAccount'
import { useSubmitAndConfirm } from './useSubmitAndConfirm'

// The contract compares against the block timestamp, which trails wall-clock
// time by a few seconds, and the completing call itself lands a block later.
const READY_BUFFER_SECONDS = 5

const ZERO = new Decimal(0)

const SOURCES = {
    request: {
        name: 'card-withdraw-request',
        description: 'Request a withdrawal from your Pera Card',
    },
    complete: {
        name: 'card-withdraw',
        description: 'Withdraw from your Pera Card',
    },
    cancel: {
        name: 'card-withdraw-cancel',
        description: 'Cancel a Pera Card withdrawal',
    },
} as const

export type UseCardWithdrawResult = {
    pending: Nullable<PendingWithdrawal>
    /** Pending amount in display units, zero when nothing is pending. */
    pendingAmount: Decimal
    /** Whole seconds until the pending request can be completed, 0 once it can. */
    secondsUntilReady: number
    isReady: boolean
    isPendingLoading: boolean
    /** Starts the timelock for `amount` (display units). */
    request: (amount: Decimal) => Promise<void>
    /** Releases the pending request to the card owner. */
    complete: () => Promise<void>
    cancel: () => Promise<void>
    isRequesting: boolean
    isCompleting: boolean
    isCancelling: boolean
}

/**
 * Withdrawing from the card is a timelocked pair of contract calls signed by
 * the card owner: `withdrawalRequest` stamps a box with the block time, and
 * `withdraw` releases the funds once `withdrawal_wait_time` has passed. Baanx
 * has no part in it, and there is one pending request per card at a time.
 */
export const useCardWithdraw = (): UseCardWithdrawResult => {
    const { network } = useNetwork()
    const queryClient = useQueryClient()
    const submit = useSubmitAndConfirm()
    const { assignFeeToGroup } = useMinimumFeeCalculator()
    const { buildRequest, buildWithdraw, buildCancel } = useEscrowWithdrawal()
    const {
        pending,
        waitTimeSeconds,
        isLoading: isPendingLoading,
        invalidate: invalidatePending,
    } = useCardPendingWithdrawalQuery()
    const owner = useCardOwnerAccount()
    const escrowCardAddress = useCardStore(state => state.escrowCardAddress)

    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )
    const { data: assets } = useAssetsQuery(usdcAssetId ? [usdcAssetId] : [])
    const decimals =
        (usdcAssetId === null
            ? undefined
            : assets.get(usdcAssetId)?.decimals) ?? USDC_FALLBACK_DECIMALS

    const pendingAmount = useMemo(
        () =>
            pending === null
                ? ZERO
                : baseUnitsToDisplayUnits(pending.amount, decimals),
        [pending, decimals],
    )

    const readyAtMs =
        pending !== null && waitTimeSeconds !== null
            ? (pending.createdAt + waitTimeSeconds + READY_BUFFER_SECONDS) *
              1000
            : null

    const [now, setNow] = useState(() => Date.now())
    const isWaiting = readyAtMs !== null && now < readyAtMs
    useEffect(() => {
        if (!isWaiting) return
        setNow(Date.now())
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [isWaiting, readyAtMs])

    const secondsUntilReady =
        readyAtMs === null
            ? 0
            : Math.max(0, Math.ceil((readyAtMs - now) / 1000))
    const isReady = readyAtMs !== null && secondsUntilReady === 0

    const [isRequesting, setIsRequesting] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)
    const [isCancelling, setIsCancelling] = useState(false)

    const requireCard = useCallback(() => {
        if (owner === null || escrowCardAddress === null) {
            throw new CardEscrowUnavailableError()
        }
        return { owner, escrowCardAddress }
    }, [owner, escrowCardAddress])

    const request = useCallback<UseCardWithdrawResult['request']>(
        async amount => {
            const card = requireCard()
            setIsRequesting(true)
            try {
                assertOnline()
                const transactions = await buildRequest({
                    sender: card.owner.address,
                    cardAddress: card.escrowCardAddress,
                    amount: BigInt(
                        displayUnitsToBaseUnits(amount, decimals).toFixed(0),
                    ),
                })
                const { transactions: unsignedTxs } = await assignFeeToGroup({
                    transactions,
                })
                await submit({ unsignedTxs, source: SOURCES.request })
                await invalidatePending()
            } catch (error) {
                throw toError(error)
            } finally {
                setIsRequesting(false)
            }
        },
        [
            requireCard,
            buildRequest,
            decimals,
            assignFeeToGroup,
            submit,
            invalidatePending,
        ],
    )

    const complete = useCallback<
        UseCardWithdrawResult['complete']
    >(async () => {
        const card = requireCard()
        if (pending === null) throw new CardEscrowUnavailableError()
        setIsCompleting(true)
        try {
            assertOnline()
            const transactions = await buildWithdraw({
                sender: card.owner.address,
                cardAddress: card.escrowCardAddress,
                amount: pending.amount,
            })
            const { transactions: unsignedTxs } = await assignFeeToGroup({
                transactions,
            })
            await submit({ unsignedTxs, source: SOURCES.complete })
            await Promise.all([
                invalidatePending(),
                queryClient.invalidateQueries({
                    queryKey: getOnChainAccountInformationQueryKey(
                        card.escrowCardAddress,
                        network,
                    ),
                }),
            ])
            invalidateAccountQueriesForAddresses(queryClient, [
                card.owner.address,
            ])
        } catch (error) {
            throw toError(error)
        } finally {
            setIsCompleting(false)
        }
    }, [
        requireCard,
        pending,
        buildWithdraw,
        assignFeeToGroup,
        submit,
        invalidatePending,
        queryClient,
        network,
    ])

    const cancel = useCallback<UseCardWithdrawResult['cancel']>(async () => {
        const card = requireCard()
        setIsCancelling(true)
        try {
            assertOnline()
            const transactions = await buildCancel({
                sender: card.owner.address,
                cardAddress: card.escrowCardAddress,
            })
            const { transactions: unsignedTxs } = await assignFeeToGroup({
                transactions,
            })
            await submit({ unsignedTxs, source: SOURCES.cancel })
            await invalidatePending()
        } catch (error) {
            throw toError(error)
        } finally {
            setIsCancelling(false)
        }
    }, [requireCard, buildCancel, assignFeeToGroup, submit, invalidatePending])

    return {
        pending,
        pendingAmount,
        secondsUntilReady,
        isReady,
        isPendingLoading,
        request,
        complete,
        cancel,
        isRequesting,
        isCompleting,
        isCancelling,
    }
}
