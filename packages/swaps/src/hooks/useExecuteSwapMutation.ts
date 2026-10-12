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

import { useMutation } from '@tanstack/react-query'
import {
    addressOn,
    getSignerFor,
    isMultisigAccount,
    useAccountsStore,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    swapAdapterFor,
    SwapAccountUnsupportedError,
    SwapCosignUnsupportedError,
} from '../chain-adapter'
import type { ExecuteSwapParams, ExecuteSwapResult } from '../execution'
import { updateSwapStatus } from '../api'
import { useSwapHandoffStore } from '../store'
import { prepareSwapTransactions } from './usePrepareTransactionsMutation'
import { useSwapScope } from './useSwapScope'

export type ExecuteSwapVariables = Omit<ExecuteSwapParams, 'account' | 'signer'>

/** Runs on the selected account's swap scope, so the scope and the signer can't disagree. */
export const useExecuteSwapMutation = () => {
    const { addSignRequest } = useSigningRequest()
    const account = useSelectedAccount()
    const scope = useSwapScope(account)
    const deviceIdOf = useDeviceIdLookup()
    const registerHandoff = useSwapHandoffStore(s => s.registerHandoff)

    return useMutation<ExecuteSwapResult, Error, ExecuteSwapVariables>({
        mutationFn: async variables => {
            if (!account || !scope) {
                throw new SwapAccountUnsupportedError()
            }
            const adapter = swapAdapterFor(scope)
            if (isMultisigAccount(account) && !adapter.submitSignedGroup) {
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
            return adapter.executeSwap(
                { ...variables, account, signer },
                {
                    scope,
                    deviceId: deviceIdOf(scope),
                    addSignRequest,
                    prepareTransactions: data =>
                        prepareSwapTransactions(data, scope),
                    updateSwapStatus: ({ swapId, data }) =>
                        updateSwapStatus(swapId, data, scope),
                    registerHandoff,
                },
            )
        },
        // A retry would re-sign and re-broadcast a group the user approved once.
        retry: false,
        throwOnError: false,
    })
}
