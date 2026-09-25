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

import { useMutation } from '@tanstack/react-query'
import type { Nullable, Network } from '@perawallet/wallet-core-shared'
import { proposeSignRequest } from '../api/endpoints'
import type {
    ProposeSignRequest,
    ProposeSignRequestResponse,
} from '../api/schema'

type UseProposeSignRequestMutationParams = {
    network: Network
}

export type UseProposeSignRequestMutationResult = {
    data: ProposeSignRequestResponse | undefined
    error: Nullable<Error>
    isError: boolean
    isIdle: boolean
    isSuccess: boolean
    mutate: (params: ProposeSignRequest) => void
    mutateAsync: (
        params: ProposeSignRequest,
    ) => Promise<ProposeSignRequestResponse>
}

export const useProposeSignRequestMutation = ({
    network,
}: UseProposeSignRequestMutationParams): UseProposeSignRequestMutationResult => {
    const mutation = useMutation({
        mutationFn: (params: ProposeSignRequest) =>
            proposeSignRequest(network, params),
    })

    return {
        data: mutation.data,
        error: mutation.error,
        isError: mutation.isError,
        isIdle: mutation.isIdle,
        isSuccess: mutation.isSuccess,
        mutate: mutation.mutate,
        mutateAsync: mutation.mutateAsync,
    }
}
