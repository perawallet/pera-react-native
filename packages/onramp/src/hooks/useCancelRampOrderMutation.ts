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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'

import { cancelRampOrder, type CancelRampOrderParams } from '../api'
import { onrampQueryKeys } from './querykeys'

export type UseCancelRampOrderMutationResult = {
    mutateAsync: (params: CancelRampOrderParams) => Promise<void>
    isPending: boolean
    isSuccess: boolean
    error: Error | null
    reset: () => void
}

export const useCancelRampOrderMutation =
    (): UseCancelRampOrderMutationResult => {
        const { network } = useNetwork()
        const queryClient = useQueryClient()

        const mutation = useMutation({
            mutationFn: (params: CancelRampOrderParams) =>
                cancelRampOrder(params, network),
            // Handled inline by the caller (toast). Mirrors `mutationDefaults`
            // (@perawallet/wallet-core-shared), which already sets
            // throwOnError: false.
            throwOnError: false,
            // Refresh the history list so the cancelled order updates ASAP.
            onSuccess: () =>
                queryClient.invalidateQueries({
                    queryKey: onrampQueryKeys.historyRoot(),
                }),
        })

        return {
            mutateAsync: mutation.mutateAsync,
            isPending: mutation.isPending,
            isSuccess: mutation.isSuccess,
            error: mutation.error,
            reset: () => mutation.reset(),
        }
    }
