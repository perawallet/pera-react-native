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

import { useCallback } from 'react'
import { ABIType, decodeAddress } from 'algosdk'
import {
    FALLBACK_MIN_TXN_FEE,
    useAlgorandClient,
    useNetwork,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { resolveEscrowChainConfig } from '../api/escrow'
import { isAlgodNotFoundError } from '../api/escrow/algod'
import mainArc56 from '../api/escrow/main-arc56.json'
import type { PendingWithdrawal } from '../models'

// AppliedBlockchain's W3Card (main) contract. Withdrawal is timelocked and
// two-step: `withdrawalRequest` writes a box under the card address stamped
// with the block time, and `withdraw` releases the funds to the card owner
// once `withdrawal_wait_time` has elapsed since then. Regenerate the vendored
// ARC-56 spec if AB changes the contract.
const MAIN_SPEC = mainArc56 as unknown as Arc56Contract

const WITHDRAWAL_REQUEST_TYPE = ABIType.from(
    '(address,address,uint64,uint64,uint64,uint64)',
)
type WithdrawalRequestTuple = [string, string, bigint, bigint, bigint, bigint]

// The map prefix comes from the spec so a renamed box map fails loudly at
// decode time rather than silently reading as "no pending withdrawal".
const WITHDRAWALS_PREFIX = Uint8Array.from(
    atob(MAIN_SPEC.state.maps.box.withdrawals.prefix ?? ''),
    char => char.charCodeAt(0),
)

const buildWithdrawalBoxName = (cardAddress: string): Uint8Array => {
    const name = new Uint8Array(WITHDRAWALS_PREFIX.length + 32)
    name.set(WITHDRAWALS_PREFIX, 0)
    name.set(decodeAddress(cardAddress).publicKey, WITHDRAWALS_PREFIX.length)
    return name
}

export type UseEscrowWithdrawalResult = {
    /** Starts the timelock for `amount` (base units) of the card's asset. */
    buildRequest: (params: {
        sender: string
        cardAddress: string
        amount: bigint
    }) => Promise<PeraTransaction[]>
    /**
     * Releases a matured request to the card owner. Builds by simulating, so
     * calling it before the wait has elapsed throws the contract's timestamp
     * assert rather than a usable group.
     */
    buildWithdraw: (params: {
        sender: string
        cardAddress: string
        amount: bigint
    }) => Promise<PeraTransaction[]>
    buildCancel: (params: {
        sender: string
        cardAddress: string
    }) => Promise<PeraTransaction[]>
    /** The card's open request, or null when its box is absent. */
    getPendingWithdrawal: (
        cardAddress: string,
    ) => Promise<Nullable<PendingWithdrawal>>
    /** `withdrawal_wait_time` in seconds; null until the contract owner sets it. */
    getWaitTimeSeconds: () => Promise<Nullable<number>>
}

export const useEscrowWithdrawal = (): UseEscrowWithdrawalResult => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()

    const getAppClient = useCallback(
        (sender?: string) => {
            const { mainAppId } = resolveEscrowChainConfig(network)
            return algokit.client.getAppClientById({
                appId: BigInt(mainAppId),
                appSpec: MAIN_SPEC,
                defaultSender: sender,
            })
        },
        [algokit, network],
    )

    const buildCall = useCallback(
        async (
            sender: string,
            params: Parameters<
                ReturnType<typeof getAppClient>['params']['call']
            >[0],
        ): Promise<PeraTransaction[]> => {
            const appClient = getAppClient(sender)
            const composer = algokit.newGroup()
            composer.addAppCallMethodCall(await appClient.params.call(params))
            const { atc } = await composer.build()
            const populated = await populateAppCallResources(
                atc,
                algokit.client.algod,
            )
            return populated.buildGroup().map(({ txn }) => txn)
        },
        [algokit, getAppClient],
    )

    const buildRequest = useCallback<UseEscrowWithdrawalResult['buildRequest']>(
        ({ sender, cardAddress, amount }) => {
            const { assetId } = resolveEscrowChainConfig(network)
            return buildCall(sender, {
                method: 'withdrawalRequest',
                args: [cardAddress, BigInt(assetId), amount],
                // Naming the card's holding keeps resource population from
                // discovering it as unnamed and then JSON-stringifying every
                // field to place it, which throws on algosdk's native bigints
                // (algokit 9.2.x).
                accountReferences: [cardAddress],
                assetReferences: [BigInt(assetId)],
            })
        },
        [buildCall, network],
    )

    const buildWithdraw = useCallback<
        UseEscrowWithdrawalResult['buildWithdraw']
    >(
        ({ sender, cardAddress, amount }) => {
            const { assetId } = resolveEscrowChainConfig(network)
            return buildCall(sender, {
                method: 'withdraw',
                args: [cardAddress, amount],
                accountReferences: [cardAddress],
                assetReferences: [BigInt(assetId)],
                // Pays for the inner asset transfer from the card to the owner.
                extraFee: AlgoAmount.MicroAlgo(Number(FALLBACK_MIN_TXN_FEE)),
            })
        },
        [buildCall, network],
    )

    const buildCancel = useCallback<UseEscrowWithdrawalResult['buildCancel']>(
        ({ sender, cardAddress }) =>
            buildCall(sender, {
                method: 'withdrawalCancel',
                args: [cardAddress],
                accountReferences: [cardAddress],
            }),
        [buildCall],
    )

    const getPendingWithdrawal = useCallback<
        UseEscrowWithdrawalResult['getPendingWithdrawal']
    >(
        async cardAddress => {
            const { mainAppId } = resolveEscrowChainConfig(network)
            try {
                const box = await algokit.client.algod
                    .getApplicationBoxByName(
                        BigInt(mainAppId),
                        buildWithdrawalBoxName(cardAddress),
                    )
                    .do()
                const [card, recipient, asset, amount, createdAt, nonce] =
                    WITHDRAWAL_REQUEST_TYPE.decode(
                        box.value,
                    ) as WithdrawalRequestTuple
                return {
                    card,
                    recipient,
                    asset: asset.toString(),
                    amount,
                    createdAt: Number(createdAt),
                    nonce,
                }
            } catch (error) {
                if (isAlgodNotFoundError(error)) return null
                throw error
            }
        },
        [algokit, network],
    )

    const getWaitTimeSeconds = useCallback<
        UseEscrowWithdrawalResult['getWaitTimeSeconds']
    >(async () => {
        const value = await getAppClient().state.global.getValue(
            'withdrawal_wait_time',
        )
        return typeof value === 'bigint' ? Number(value) : null
    }, [getAppClient])

    return {
        buildRequest,
        buildWithdraw,
        buildCancel,
        getPendingWithdrawal,
        getWaitTimeSeconds,
    }
}
