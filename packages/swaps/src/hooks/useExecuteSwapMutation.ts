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
import { useMutation } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    addressOn,
    getSignerFor,
    isMultisigAccount,
    useAccountsStore,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    swapAdapterFor,
    SwapAccountUnsupportedError,
    SwapCosignUnsupportedError,
} from '../chain-adapter'
import { scopeOfSwapAsset } from '../api/router-ids'
import type { ExecuteSwapParams, ExecuteSwapResult } from '../execution'
import type { SwapAsset, SwapQuote, SwapTrackedOrder } from '../models'
import { useSwapHandoffStore, useSwapTrackingStore } from '../store'
import { useCreateSwapOrderMutation } from './useCreateSwapOrderMutation'
import { useReportSwapOrderMutation } from './useReportSwapOrderMutation'
import { useSwapScope } from './useSwapScope'

export type ExecuteSwapVariables = Omit<ExecuteSwapParams, 'account' | 'signer'>

// TanStack swaps a pending mutation's options on every render, so the account and scope travel in the variables.
type ExecuteSwapMutationVariables = ExecuteSwapVariables & {
    account: Nullable<WalletAccount>
    scope: Nullable<ChainScope>
}

const trackedAsset = (asset: SwapAsset) => ({
    ref: asset.ref,
    unitName: asset.unitName ?? null,
})

const toTrackedOrder = (
    quote: SwapQuote,
    orderId: string,
    now: number,
): SwapTrackedOrder => ({
    orderId,
    sourceScope: scopeOfSwapAsset(quote.request.sourceAsset),
    destinationScope: scopeOfSwapAsset(quote.request.destinationAsset),
    sourceAddress: quote.request.sourceAddress,
    destinationAddress: quote.request.destinationAddress,
    assetIn: trackedAsset(quote.assetIn),
    assetOut: trackedAsset(quote.assetOut),
    status: 'pending',
    createdAt: now,
    checkedAt: now,
})

export type UseExecuteSwapMutationResult = {
    mutateAsync: (variables: ExecuteSwapVariables) => Promise<ExecuteSwapResult>
    reset: () => void
}

/** Runs on the selected account's swap scope, so the scope and the signer can't disagree. */
export const useExecuteSwapMutation = (): UseExecuteSwapMutationResult => {
    const { addSignRequest } = useSigningRequest()
    const account = useSelectedAccount()
    const scope = useSwapScope(account)
    const deviceIdOf = useDeviceIdLookup()
    const registerHandoff = useSwapHandoffStore(s => s.registerHandoff)
    const trackOrder = useSwapTrackingStore(s => s.trackOrder)
    // Mutations rather than bare calls, so a failure reaches the app's
    // mutation-cache logging.
    const { mutateAsync: createOrderOnScope } = useCreateSwapOrderMutation()
    const { mutateAsync: reportOrderOnScope } = useReportSwapOrderMutation()

    const { mutateAsync, reset } = useMutation<
        ExecuteSwapResult,
        Error,
        ExecuteSwapMutationVariables
    >({
        mutationFn: async ({ account, scope, ...variables }) => {
            if (!account || !scope) {
                throw new SwapAccountUnsupportedError()
            }
            const adapter = swapAdapterFor(scope)
            if (isMultisigAccount(account) && !adapter.supportsCosignedSwaps) {
                throw new SwapCosignUnsupportedError(adapter.chainId)
            }
            const address = addressOn(account, scope)
            const signer = address
                ? getSignerFor(
                      address,
                      useAccountsStore.getState().accounts,
                      scope.chainId,
                  )
                : null
            const result = await adapter.executeSwap(
                { ...variables, account, signer },
                {
                    scope,
                    deviceId: deviceIdOf(deploymentOf(scope)),
                    addSignRequest,
                    createOrder: quoteId =>
                        createOrderOnScope({ quoteId, scope }),
                    reportOrder: ({ orderId, report }) =>
                        reportOrderOnScope({ orderId, report, scope }),
                    registerHandoff,
                },
            )
            // Only a cross-chain order outlives the broadcast: its payout
            // lands later, on another chain.
            if (
                result.kind === 'success' &&
                variables.quote.routeKind === 'cross-chain'
            ) {
                trackOrder(
                    toTrackedOrder(variables.quote, result.orderId, Date.now()),
                )
            }
            return result
        },
        // A retry would re-sign and re-broadcast a group the user approved once.
        retry: false,
        throwOnError: false,
    })

    const executeSwap = useCallback(
        (variables: ExecuteSwapVariables) =>
            mutateAsync({ ...variables, account, scope }),
        [mutateAsync, account, scope],
    )

    return { mutateAsync: executeSwap, reset }
}
