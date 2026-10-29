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

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { addSignature } from '../api/endpoints'
import type { ProposeSignRequestResponse } from '../api/schema'
import { getSignRequestDetailQueryKey } from './querykeys'

type UseDeclineSignRequestMutationParams = {
    scope: ChainScope
    signRequestId: string
}

type DeclineSignRequestInput = {
    address: string
    deviceId: string
}

// TanStack swaps a pending mutation's options on every render, so the scope
// travels in the variables to post and invalidate on the same scope.
type DeclineSignRequestVariables = DeclineSignRequestInput & {
    scope: ChainScope
}

export type UseDeclineSignRequestMutationResult = {
    data: Optional<ProposeSignRequestResponse>
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
    scope,
    signRequestId,
}: UseDeclineSignRequestMutationParams): UseDeclineSignRequestMutationResult => {
    const rqClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: ({
            address,
            deviceId,
            scope,
        }: DeclineSignRequestVariables) =>
            addSignature(scope, signRequestId, [
                {
                    address,
                    response: 'declined',
                    device_id: deviceId,
                },
            ]),
        onSuccess: (_data, { scope }) => {
            void rqClient.invalidateQueries({
                queryKey: getSignRequestDetailQueryKey(scope, signRequestId),
            })
        },
    })

    const { mutate, mutateAsync } = mutation
    const mutateOnScope = useCallback(
        (input: DeclineSignRequestInput) => mutate({ ...input, scope }),
        [mutate, scope],
    )
    const mutateAsyncOnScope = useCallback(
        (input: DeclineSignRequestInput) => mutateAsync({ ...input, scope }),
        [mutateAsync, scope],
    )

    return {
        data: mutation.data,
        error: mutation.error,
        isError: mutation.isError,
        isIdle: mutation.isIdle,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        mutate: mutateOnScope,
        mutateAsync: mutateAsyncOnScope,
    }
}
