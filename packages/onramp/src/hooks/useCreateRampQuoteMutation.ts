/*
 Copyright 2022-2025 Pera Wallet, LDA
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

import { createRampQuote, type CreateRampQuoteParams } from '../api'
import type { RampQuote } from '../models'

export type UseCreateRampQuoteMutationResult = {
    mutateAsync: (params: CreateRampQuoteParams) => Promise<RampQuote[]>
    isPending: boolean
    isSuccess: boolean
    error: Error | null
    reset: () => void
}

export const useCreateRampQuoteMutation =
    (): UseCreateRampQuoteMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation({
            mutationFn: (params: CreateRampQuoteParams) =>
                createRampQuote(params, network),
            // The app defaults mutations to throwOnError:true (escalates to the
            // root error boundary). Quote errors (e.g. SourceAmountIsTooLow) are
            // expected and handled inline by the form, so opt out here.
            throwOnError: false,
        })

        return {
            mutateAsync: mutation.mutateAsync,
            isPending: mutation.isPending,
            isSuccess: mutation.isSuccess,
            error: mutation.error,
            reset: () => mutation.reset(),
        }
    }
