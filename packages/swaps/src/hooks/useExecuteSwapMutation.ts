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
    useMinimumFeeConfig,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useSelectedAccount,
    useSignerFor,
} from '@perawallet/wallet-core-accounts'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { swapAdapterFor } from '../chain-adapter'
import type { ExecuteSwapParams, ExecuteSwapResult } from '../execution'
import { useSwapHandoffStore } from '../store'
import { usePrepareTransactionsMutation } from './usePrepareTransactionsMutation'
import { useUpdateSwapStatusMutation } from './useUpdateSwapStatusMutation'

export type ExecuteSwapVariables = Omit<ExecuteSwapParams, 'account' | 'signer'>

export const useExecuteSwapMutation = () => {
    const { addSignRequest } = useSigningRequest()
    const { network } = useNetwork()
    const account = useSelectedAccount()
    const signer = useSignerFor(account?.address)
    const { assetMbr } = useMinimumFeeConfig()
    const deviceId = useDeviceID(network)
    const registerHandoff = useSwapHandoffStore(s => s.registerHandoff)
    const { mutateAsync: prepareTransactions } =
        usePrepareTransactionsMutation()
    const { mutateAsync: updateSwapStatus } = useUpdateSwapStatusMutation()

    return useMutation<ExecuteSwapResult, Error, ExecuteSwapVariables>({
        mutationFn: variables =>
            swapAdapterFor(network).executeSwap(
                { ...variables, account, signer },
                {
                    network,
                    assetOptInMinBalance: assetMbr,
                    deviceId,
                    addSignRequest,
                    prepareTransactions,
                    updateSwapStatus,
                    registerHandoff,
                },
            ),
        // A retry would re-sign and re-broadcast a group the user approved once.
        retry: false,
        throwOnError: false,
    })
}
