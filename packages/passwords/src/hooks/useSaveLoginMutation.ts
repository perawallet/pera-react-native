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
import { usePasskeyAutofillService } from '@perawallet/wallet-core-passkeys'
import { publishLoginIdentities } from '../identities/publishIdentities'
import type { Login } from '../models/login'
import { saveLogin, type SaveLoginInput } from '../storage/loginStore'
import { loginsQueryKeyRoot } from './useLoginsQuery'

export type UseSaveLoginMutationResult = {
    saveLogin: (input: SaveLoginInput) => Promise<Login>
    isPending: boolean
    isError: boolean
    error: Error | null
}

export const useSaveLoginMutation = (): UseSaveLoginMutationResult => {
    const service = usePasskeyAutofillService()
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: (input: SaveLoginInput) => saveLogin(input),
        onSuccess: async () => {
            await publishLoginIdentities(service)
            void queryClient.invalidateQueries({
                queryKey: loginsQueryKeyRoot,
            })
        },
    })

    return {
        saveLogin: mutation.mutateAsync,
        isPending: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error as Error | null,
    }
}
