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

import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import { deleteImportInbox } from '../api/endpoints'

type UseDeleteImportInboxMutationParams = {
    network: Network
    deviceId: string
    onSuccess?: () => void
}

type DeleteImportInboxInput = {
    multisigAddress: string
}

export const useDeleteImportInboxMutation = ({
    network,
    deviceId,
    onSuccess,
}: UseDeleteImportInboxMutationParams): UseMutationResult<
    void,
    Error,
    DeleteImportInboxInput
> => {
    return useMutation({
        mutationFn: ({ multisigAddress }: DeleteImportInboxInput) =>
            deleteImportInbox(network, deviceId, multisigAddress),
        onSuccess,
    })
}
