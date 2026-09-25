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
import type { Nullable, Network } from '@perawallet/wallet-core-shared'
import { addSignature } from '../api/endpoints'
import type { ProposeSignRequestResponse } from '../api/schema'
import { getSignRequestDetailQueryKey } from './querykeys'

type UseDeclineSignRequestMutationParams = {
    network: Network
    signRequestId: string
}

type DeclineSignRequestInput = {
    address: string
    deviceId: string
}

export type UseDeclineSignRequestMutationResult = {
    data: ProposeSignRequestResponse | undefined
    error: Nullable<Error>
    isError: boolean
    isIdle: boolean
    isPending: boolean
    isSuccess: boolean
    mutate: (params: DeclineSignRequestInput) => void
    mutateAsync: (
        params: DeclineSignRequestInput,
    ) => Promise<ProposeSignRequestResponse>
}

export const useDeclineSignRequestMutation = ({
    network,
    signRequestId,
}: UseDeclineSignRequestMutationParams): UseDeclineSignRequestMutationResult => {
    const rqClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: ({ address, deviceId }: DeclineSignRequestInput) =>
            addSignature(network, signRequestId, [
                {
                    address,
                    response: 'declined',
                    device_id: deviceId,
                },
            ]),
        onSuccess: () => {
            void rqClient.invalidateQueries({
                queryKey: getSignRequestDetailQueryKey(network, signRequestId),
            })
        },
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
