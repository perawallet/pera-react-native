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

import {
    useMutation,
    useQueryClient,
    type UseMutationResult,
} from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import { addSignature } from '../api/endpoints'
import type { AddSignatureRequest } from '../api/schema'
import type { ProposeSignRequestResponse } from '../api/schema'
import { getSignRequestDetailQueryKey } from './querykeys'

type UseAddSignatureMutationParams = {
    network: Network
    signRequestId: string
}

type AddSignatureMutationInput = {
    responses: AddSignatureRequest[]
}

export const useAddSignatureMutation = ({
    network,
    signRequestId,
}: UseAddSignatureMutationParams): UseMutationResult<
    ProposeSignRequestResponse,
    Error,
    AddSignatureMutationInput
> => {
    const rqClient = useQueryClient()

    return useMutation({
        mutationFn: ({ responses }: AddSignatureMutationInput) =>
            addSignature(network, signRequestId, responses),
        onSuccess: () => {
            void rqClient.invalidateQueries({
                queryKey: getSignRequestDetailQueryKey(network, signRequestId),
            })
        },
    })
}
