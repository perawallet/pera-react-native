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
import { fetchVerificationSession } from '../api/user'
import type { VeriffSession } from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseStartVerificationMutationResult = CardMutationResult<
    void,
    VeriffSession
>

/** Starts KYC and returns the Veriff session URL for the caller to open. */
export const useStartVerificationMutation =
    (): UseStartVerificationMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<VeriffSession, Error, void>({
            mutationFn: () => fetchVerificationSession({ network }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
