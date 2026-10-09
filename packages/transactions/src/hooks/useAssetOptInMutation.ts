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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useFeeConfig } from '@perawallet/wallet-core-signing'
import {
    fetchOnChainAccountState,
    insertAssetHolding,
} from '@perawallet/wallet-core-accounts'
import { fetchAndPersistAssets } from '@perawallet/wallet-core-assets'
import {
    algosToMicroAlgosBigInt,
    assertOnline,
    formatCurrency,
    microAlgosToAlgos,
    toBigInt,
} from '@perawallet/wallet-core-shared'
import {
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../errors'
import { sendFlowFeatureFor } from '../chain-adapter'
import { useAssetHoldingMutation } from './useAssetHoldingMutation'

import type { Nullable } from '@perawallet/wallet-core-shared'

type AssetOptInParams = {
    sender: string
    assetId: bigint
}

type UseAssetOptInMutationResult = {
    optIn: (params: AssetOptInParams) => Promise<{ txIds: string[] }>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
}

const SOURCE = {
    name: 'asset-opt-in',
    description: 'Opt in to an asset',
}

// `shortfall` is in base units. minPrecision 0 trims trailing zeros, so 0.1
// ALGO reads "0.1", not "0.100000".
const formatAlgoShortfall = (shortfall: bigint): string =>
    formatCurrency(
        microAlgosToAlgos(shortfall),
        6,
        'ALGO',
        undefined,
        false,
        false,
        0,
    )

export const useAssetOptInMutation = (
    scope: ChainScope,
): UseAssetOptInMutationResult => {
    const { assetOptInMinBalance } = useFeeConfig(scope.chainId)

    const { mutateAsync, isLoading, isError, error } =
        useAssetHoldingMutation<AssetOptInParams>({
            scope,
            source: SOURCE,
            run: async ({ sender, assetId }, { scope, assignFees, submit }) => {
                assertOnline()

                const accountState = await fetchOnChainAccountState(
                    sender,
                    scope,
                )
                const assetIdString = String(assetId)
                const isOptedIn = accountState.holdings.some(
                    holding => holding.assetId === assetIdString,
                )
                if (isOptedIn) {
                    throw new AlreadyOptedInError()
                }

                const unsignedTxs = await assignFees(
                    await sendFlowFeatureFor(
                        scope,
                        'assetHolding',
                    ).buildOptInTxs({ scope, sender, assetId }),
                )

                // Check against the fee actually being submitted: reading it
                // back off the built group is what keeps a quantum sender's
                // higher fee from passing a check that algod then fails.
                const feeTotal = unsignedTxs.reduce(
                    (total, txn) => total + txn.fee,
                    0n,
                )
                const balance = toBigInt(accountState.nativeBalanceBaseUnits)
                const balanceNeeded =
                    algosToMicroAlgosBigInt(accountState.minBalance) +
                    assetOptInMinBalance +
                    feeTotal
                if (balance < balanceNeeded) {
                    throw new InsufficientBalanceForOptInError(
                        formatAlgoShortfall(balanceNeeded - balance),
                    )
                }

                const { txIds } = await submit(unsignedTxs)

                // Persist the holding and the asset's metadata before the
                // invalidation, so the UI resolves the asset on its next
                // render instead of waiting for the next sync poll.
                await insertAssetHolding({
                    accountAddress: sender,
                    assetId: assetIdString,
                    scope,
                })
                await fetchAndPersistAssets([assetIdString], scope)

                return { txIds, sender }
            },
        })

    return {
        optIn: mutateAsync,
        isLoading,
        isError,
        error,
    }
}

export {
    AlreadyOptedInError,
    InsufficientBalanceForOptInError,
} from '../errors'
export type { AssetOptInParams, UseAssetOptInMutationResult }
