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
import { useNetwork } from '@perawallet/wallet-core-blockchain'

import { createRampOrder, type CreateRampOrderParams } from '../api'
import type { RampOrder } from '../models'

export type UseCreateRampOrderMutationResult = {
    mutate: (params: CreateRampOrderParams) => void
    mutateAsync: (params: CreateRampOrderParams) => Promise<RampOrder>
    isSuccess: boolean
    isError: boolean
    isPaused: boolean
}

export const useCreateRampOrderMutation =
    (): UseCreateRampOrderMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation({
            mutationFn: (params: CreateRampOrderParams) =>
                createRampOrder(params, network),
            // Handled inline by the form's confirm flow (toast). Mirrors
            // `mutationDefaults` (@perawallet/wallet-core-shared), which already
            // sets throwOnError: false.
            throwOnError: false,
        })

        return {
            mutate: mutation.mutate,
            mutateAsync: mutation.mutateAsync,
            isSuccess: mutation.isSuccess,
            isError: mutation.isError,
            isPaused: mutation.isPaused,
        }
    }
