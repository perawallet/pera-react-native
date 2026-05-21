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
import type { Network } from '@perawallet/wallet-core-shared'
import { markSignRequestsConfirmed } from '../api/endpoints'

type MarkSignRequestsConfirmedInput = {
    network: Network
    deviceId: string
    signRequestIds: string[]
}

type UseMarkSignRequestsConfirmedMutationResult = {
    /**
     * Tells the backend the wallet delivered the assembled signed
     * transaction(s). Rejects on failure — callers treat the call as
     * best-effort and swallow rejections.
     */
    markConfirmed: (input: MarkSignRequestsConfirmedInput) => Promise<void>
    isPending: boolean
}

/**
 * Marks sign requests as confirmed (`POST /sign-requests/mark-confirmed/`)
 * once the wallet has delivered the assembled signed transaction to the
 * dApp, so the backend skips its own broadcast for `type: 'sync'` requests.
 *
 * `network` is part of the mutation input rather than a hook parameter so a
 * single mutation instance can serve handoffs on different networks.
 */
export const useMarkSignRequestsConfirmedMutation =
    (): UseMarkSignRequestsConfirmedMutationResult => {
        const mutation = useMutation({
            mutationFn: ({
                network,
                deviceId,
                signRequestIds,
            }: MarkSignRequestsConfirmedInput) =>
                markSignRequestsConfirmed(network, {
                    device_id: deviceId,
                    proposed_sign_request_ids: signRequestIds,
                }),
        })

        return {
            // `mutateAsync` is referentially stable across renders.
            markConfirmed: mutation.mutateAsync,
            isPending: mutation.isPending,
        }
    }
