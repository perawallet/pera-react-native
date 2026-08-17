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
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { KeyStoreExtension } from '@algorandfoundation/keystore-core'
import type { Passkey } from '../models/passkey'
import { usePasskeyAutofillService } from './usePasskeyAutofillService'
import { passkeysQueryKeyRoot } from './usePasskeysQuery'

export type UseRemovePasskeyMutationResult = {
    removePasskey: (passkey: Passkey) => Promise<void>
    isPending: boolean
    isError: boolean
    error: Error | null
}

/**
 * Removes a passkey end-to-end:
 *  1. Delete from the native autofill identity store (best-effort).
 *  2. Remove the corresponding keystore key (when keystore-backed).
 *  3. Trigger a native identity refresh so iOS Autofill drops the row.
 *  4. Invalidate every passkey query so the UI reflects the new state.
 */
export const useRemovePasskeyMutation = (): UseRemovePasskeyMutationResult => {
    const service = usePasskeyAutofillService()
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: async (passkey: Passkey): Promise<void> => {
            await service.deleteCredential(passkey.keyId).catch(() => undefined)

            if (passkey.source === 'keystore') {
                const provider = getProvider() as unknown as KeyStoreExtension
                await provider.key.store.remove(passkey.keyId)
            }

            await service.refreshCredentialIdentities().catch(() => undefined)
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: passkeysQueryKeyRoot,
            })
        },
    })

    return {
        removePasskey: mutation.mutateAsync,
        isPending: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error as Error | null,
    }
}
