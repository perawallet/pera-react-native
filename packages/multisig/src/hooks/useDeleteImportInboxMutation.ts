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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useMutation } from '@tanstack/react-query'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { deleteImportInbox } from '../api/endpoints'

type UseDeleteImportInboxMutationParams = {
    scope: ChainScope
    deviceId: string
    onSuccess?: () => void
}

type DeleteImportInboxInput = {
    multisigAddress: string
}

export type UseDeleteImportInboxMutationResult = {
    data: void
    error: Nullable<Error>
    isError: boolean
    isIdle: boolean
    isPending: boolean
    isSuccess: boolean
    mutate: (params: DeleteImportInboxInput) => void
    mutateAsync: (params: DeleteImportInboxInput) => Promise<void>
}

export const useDeleteImportInboxMutation = ({
    scope,
    deviceId,
    onSuccess,
}: UseDeleteImportInboxMutationParams): UseDeleteImportInboxMutationResult => {
    const mutation = useMutation({
        mutationFn: ({ multisigAddress }: DeleteImportInboxInput) =>
            deleteImportInbox(scope, deviceId, multisigAddress),
        onSuccess,
    })

    return {
        data: mutation.data,
        error: mutation.error,
        isError: mutation.isError,
        isIdle: mutation.isIdle,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        mutate: mutation.mutate,
        mutateAsync: mutation.mutateAsync,
    }
}
