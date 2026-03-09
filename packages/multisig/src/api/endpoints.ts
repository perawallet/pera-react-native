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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    createMultisigAccountResponseSchema,
    signRequestDetailResponseSchema,
    type CreateMultisigAccountRequest,
    type CreateMultisigAccountResponse,
    type ProposeSignRequest,
    type ProposeSignRequestResponse,
    type AddSignatureRequest,
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

export const proposeSignRequest = async (
    network: Network,
    params: ProposeSignRequest,
): Promise<ProposeSignRequestResponse> => {
    const response = await queryClient<ProposeSignRequestResponse>({
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
): Promise<ProposeSignRequestResponse> => {
    const response = await queryClient<ProposeSignRequestResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/joint-accounts/sign-requests/${signRequestId}/responses/`,
        data: params,
    })

    return signRequestDetailResponseSchema.parse(response.data)
}

export const getSignRequestDetail = async (
    network: Network,
    signRequestId: string,
): Promise<SignRequestDetailResponse> => {
    const response = await queryClient<SignRequestDetailResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/joint-accounts/sign-requests/${signRequestId}/with-signatures/`,
    })

    return signRequestDetailResponseSchema.parse(response.data)
}

export const deleteImportInbox = async (
    network: Network,
    deviceId: string,
    multisigAddress: string,
): Promise<void> => {
    await queryClient<void>({
        backend: 'pera',
        network,
        method: 'DELETE',
        url: `/v1/joint-accounts/inbox/device-import/${deviceId}/${multisigAddress}/`,
    })
}
