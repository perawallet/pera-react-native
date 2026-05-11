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

import {
    queryClient,
    getHttpStatus,
    type Network,
} from '@perawallet/wallet-core-shared'
import {
    createMultisigAccountResponseSchema,
    searchSignRequestsResponseSchema,
    signRequestDetailResponseSchema,
    type CreateMultisigAccountRequest,
    type CreateMultisigAccountResponse,
    type ProposeSignRequest,
    type AddSignatureRequest,
    type SearchSignRequestsRequest,
    type SearchSignRequestsResponse,
    type SignRequestDetailResponse,
} from './schema'

export const createMultisigAccount = async (
    network: Network,
    params: CreateMultisigAccountRequest,
): Promise<CreateMultisigAccountResponse> => {
    const response = await queryClient<CreateMultisigAccountResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/v1/joint-accounts/accounts/',
        data: params,
    })

    return createMultisigAccountResponseSchema.parse(response.data)
}

export const getMultisigAccountDetail = async (
    network: Network,
    address: string,
): Promise<CreateMultisigAccountResponse> => {
    const response = await queryClient<CreateMultisigAccountResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/joint-accounts/accounts/${address}/`,
    })

    return createMultisigAccountResponseSchema.parse(response.data)
}

export const checkIsMultisigAddress = async (
    network: Network,
    address: string,
): Promise<boolean> => {
    try {
        await getMultisigAccountDetail(network, address)
        return true
    } catch (error: unknown) {
        if (getHttpStatus(error) === 404) {
            return false
        }
        throw error
    }
}

export const proposeSignRequest = async (
    network: Network,
    params: ProposeSignRequest,
): Promise<SignRequestDetailResponse> => {
    const response = await queryClient<SignRequestDetailResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/v1/joint-accounts/sign-requests/',
        data: params,
    })

    return signRequestDetailResponseSchema.parse(response.data)
}

export const addSignature = async (
    network: Network,
    signRequestId: string,
    params: AddSignatureRequest[],
): Promise<SignRequestDetailResponse> => {
    const response = await queryClient<SignRequestDetailResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/joint-accounts/sign-requests/${signRequestId}/responses/`,
        data: params,
    })

    return signRequestDetailResponseSchema.parse(response.data)
}

export const searchSignRequests = async (
    network: Network,
    params: SearchSignRequestsRequest,
): Promise<SearchSignRequestsResponse> => {
    const response = await queryClient<SearchSignRequestsResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: '/v1/joint-accounts/sign-requests/search/',
        data: params,
    })

    return searchSignRequestsResponseSchema.parse(response.data)
}

export const getSignRequestDetail = async (
    network: Network,
    deviceId: string,
    signRequestId: string,
): Promise<SignRequestDetailResponse> => {
    const searchResponse = await searchSignRequests(network, {
        device_id: deviceId,
        sign_request_id: signRequestId,
    })
    const match = searchResponse.results?.find(r => r.id === signRequestId)
    if (!match) {
        throw new Error(
            `Sign request not found in search results: ${signRequestId}`,
        )
    }
    return signRequestDetailResponseSchema.parse(match)
}

export const deleteImportInbox = async (
    network: Network,
    deviceId: string,
    multisigAddress: string,
): Promise<void> => {
    await queryClient<string>({
        backend: 'pera',
        network,
        method: 'DELETE',
        url: `/v1/joint-accounts/inbox/device-import/${deviceId}/${multisigAddress}/`,
        responseType: 'text',
    })
}
