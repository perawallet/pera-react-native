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

import { useCallback, useMemo, useState } from 'react'
import type { Decimal } from 'decimal.js'
import { useQueryClient } from '@tanstack/react-query'
import {
    useCardStore,
    useSubmitAndConfirmMutation,
} from '@perawallet/wallet-core-card'
import {
    getOnChainAccountInformationQueryKey,
    invalidateAccountQueriesForAddresses,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getKnownAssetId, useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    displayUnitsToBaseUnits,
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useMinimumFeeCalculator } from '@perawallet/wallet-core-signing'
import { assertOnline, toError } from '@perawallet/wallet-core-shared'
import { USDC_FALLBACK_DECIMALS } from '../utils/usdc'

/**
 * Thrown when there is no escrow card to act on: none has been created on this
 * network yet, its owner is no longer in the wallet, or the network has no
 * known USDC.
 */
export class CardEscrowUnavailableError extends Error {
    constructor() {
        super('No escrow card available')
        this.name = 'CardEscrowUnavailableError'
    }
}

export type CardManualDepositParams = {
    account: WalletAccount
    /** Display units, e.g. `0.4` USDC. */
    amount: Decimal
}

export type UseCardManualDepositResult = {
    deposit: (params: CardManualDepositParams) => Promise<{ txIds: string[] }>
    isDepositing: boolean
}

const SOURCE = {
    name: 'card-add-funds',
    description: 'Add funds to your Pera Card',
}

/**
 * Manual funding, which on the escrow design is nothing more than a USDC
 * transfer to the card's own account: it is already opted in and rekeyed to the
 * card app, so the contract spends from it without any further authorization.
 * Baanx has no deposit endpoint for non-custodial platforms, and the balance
 * the app shows is read straight off that account.
 */
export const useCardManualDeposit = (): UseCardManualDepositResult => {
    const { network } = useNetwork()
    const algokit = useAlgorandClient()
    const queryClient = useQueryClient()
    const { mutateAsync: submit } = useSubmitAndConfirmMutation()
    const { assignFeeToGroup } = useMinimumFeeCalculator()
    const escrowCardAddress = useCardStore(state => state.escrowCardAddress)
    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )
    const { data: assets } = useAssetsQuery(usdcAssetId ? [usdcAssetId] : [])
    const [isDepositing, setIsDepositing] = useState(false)

    const deposit = useCallback(
        async ({
            account,
            amount,
        }: CardManualDepositParams): Promise<{ txIds: string[] }> => {
            if (escrowCardAddress === null || usdcAssetId === null) {
                throw new CardEscrowUnavailableError()
            }
            setIsDepositing(true)
            try {
                assertOnline()

                const decimals =
                    assets.get(usdcAssetId)?.decimals ?? USDC_FALLBACK_DECIMALS
                const composer = algokit.newGroup()
                composer.addAssetTransfer({
                    sender: account.address,
                    receiver: escrowCardAddress,
                    assetId: BigInt(usdcAssetId),
                    amount: BigInt(
                        displayUnitsToBaseUnits(amount, decimals).toFixed(0),
                    ),
                })
                const { transactions } = await composer.build()
                // Quantum senders need a fee sized for a Falcon envelope, which
                // AlgoKit's Ed25519 estimate undercuts.
                const { transactions: unsignedTxs } = await assignFeeToGroup({
                    transactions: transactions.map(built => built.txn),
                })

                const result = await submit({ unsignedTxs, source: SOURCE })

                await queryClient.invalidateQueries({
                    queryKey: getOnChainAccountInformationQueryKey(
                        escrowCardAddress,
                        network,
                    ),
                })
                invalidateAccountQueriesForAddresses(queryClient, [
                    account.address,
                ])

                return result
            } catch (error) {
                throw toError(error)
            } finally {
                setIsDepositing(false)
            }
        },
        [
            algokit,
            assets,
            assignFeeToGroup,
            escrowCardAddress,
            network,
            queryClient,
            submit,
            usdcAssetId,
        ],
    )

    return { deposit, isDepositing }
}
