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
    addDeviceIntegrityHeader,
    queryClient,
    type Network,
} from '@perawallet/wallet-core-shared'

import {
    feeDelegationResponseSchema,
    type FeeDelegationApiResponse,
    type FeeDelegationRequest,
} from './schema'

/**
 * Asks the backend to sponsor the fees (and, with `includeMbr`, the MBR
 * shortfall) for an unsigned transaction group. The backend prepends a
 * sponsor payment, RE-GROUPS the whole payload (new group id), signs only the
 * sponsor slot, and returns the ARC-0001 group for the wallet to sign its own
 * slots. The route sits behind the app-integrity guard, so a valid (non-
 * expired) attestation token is required.
 */
export const requestFeeDelegation = async (
    request: FeeDelegationRequest,
    integrityToken: string,
    network: Network,
    signal?: AbortSignal,
): Promise<FeeDelegationApiResponse> => {
    const response = await queryClient<unknown>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/api/v3/fee-delegation',
        data: request,
        headers: addDeviceIntegrityHeader({
            'x-app-integrity-token': integrityToken,
        }),
        signal,
    })

    return feeDelegationResponseSchema.parse(response.data)
}
