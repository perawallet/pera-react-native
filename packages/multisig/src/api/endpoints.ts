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
import { queryClient, getHttpStatus } from '@perawallet/wallet-core-shared'
import {
    createMultisigAccountResponseSchema,
    getSignRequestsWithSignaturesResponseSchema,
    searchSignRequestsResponseSchema,
    signRequestDetailResponseSchema,
    type CreateMultisigAccountRequest,
    type CreateMultisigAccountResponse,
    type GetSignRequestsWithSignaturesRequest,
    type GetSignRequestsWithSignaturesResponse,
    type MarkSignRequestsConfirmedRequest,
    type ProposeSignRequest,
    type AddSignatureRequest,
    type SearchSignRequestsRequest,
    type SearchSignRequestsResponse,
    type SignRequestDetailResponse,
} from './schema'

export const createMultisigAccount = async (
    scope: ChainScope,
    params: CreateMultisigAccountRequest,
): Promise<CreateMultisigAccountResponse> => {
    const response = await queryClient<CreateMultisigAccountResponse>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: '/v1/joint-accounts/accounts/',
        data: params,
    })

    return createMultisigAccountResponseSchema.parse(response.data)
}

export const getMultisigAccountDetail = async (
    scope: ChainScope,
    address: string,
): Promise<CreateMultisigAccountResponse> => {
    const response = await queryClient<CreateMultisigAccountResponse>({
        backend: 'pera',
        scope,
        method: 'GET',
        url: `/v1/joint-accounts/accounts/${address}/`,
    })

    return createMultisigAccountResponseSchema.parse(response.data)
}

export const checkIsMultisigAddress = async (
    scope: ChainScope,
    address: string,
): Promise<boolean> => {
    try {
        await getMultisigAccountDetail(scope, address)
        return true
    } catch (error: unknown) {
        if (getHttpStatus(error) === 404) {
            return false
        }
        throw error
    }
}

export const proposeSignRequest = async (
    scope: ChainScope,
    params: ProposeSignRequest,
): Promise<SignRequestDetailResponse> => {
    const response = await queryClient<SignRequestDetailResponse>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: '/v1/joint-accounts/sign-requests/',
        data: params,
    })

    return signRequestDetailResponseSchema.parse(response.data)
}

export const addSignature = async (
    scope: ChainScope,
    signRequestId: string,
    params: AddSignatureRequest[],
): Promise<SignRequestDetailResponse> => {
    const response = await queryClient<SignRequestDetailResponse>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: `/v1/joint-accounts/sign-requests/${signRequestId}/responses/`,
        data: params,
    })

    return signRequestDetailResponseSchema.parse(response.data)
}

export const searchSignRequests = async (
    scope: ChainScope,
    params: SearchSignRequestsRequest,
): Promise<SearchSignRequestsResponse> => {
    const response = await queryClient<SearchSignRequestsResponse>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: '/v1/joint-accounts/sign-requests/search/',
        data: params,
    })

    return searchSignRequestsResponseSchema.parse(response.data)
}

export const getSignRequestDetail = async (
    scope: ChainScope,
    deviceId: string,
    signRequestId: string,
): Promise<SignRequestDetailResponse> => {
    const searchResponse = await searchSignRequests(scope, {
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
    scope: ChainScope,
    deviceId: string,
    multisigAddress: string,
): Promise<void> => {
    await queryClient<string>({
        backend: 'pera',
        scope,
        method: 'DELETE',
        url: `/v1/joint-accounts/inbox/device-import/${deviceId}/${multisigAddress}/`,
        responseType: 'text',
    })
}

/**
 * Bulk-fetch sign requests including per-participant signatures. Used by
 * the WC-handoff resolver to read the collected sigs once threshold is
 * met, so the wallet can assemble the composite multisig signed
 * transaction and deliver it to the dApp.
 *
 * Unlike `searchSignRequests` (which strips signatures from its
 * response), this endpoint returns the raw signature bytes per
 * participant per transaction.
 */
export const getSignRequestsWithSignatures = async (
    scope: ChainScope,
    params: GetSignRequestsWithSignaturesRequest,
): Promise<GetSignRequestsWithSignaturesResponse> => {
    const response = await queryClient<GetSignRequestsWithSignaturesResponse>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: '/v1/joint-accounts/sign-requests/with-signatures/',
        data: params,
    })
    return getSignRequestsWithSignaturesResponseSchema.parse(response.data)
}

/**
 * Tell the backend the wallet has delivered the assembled signed
 * transaction for these sign-request IDs. The backend cleans up the
 * record and (for `type: "sync"` requests) does NOT attempt its own
 * broadcast. Best-effort: a failure here is non-fatal because the dApp
 * has already received the signed bytes.
 */
export const markSignRequestsConfirmed = async (
    scope: ChainScope,
    params: MarkSignRequestsConfirmedRequest,
): Promise<void> => {
    await queryClient<void>({
        backend: 'pera',
        scope,
        method: 'POST',
        url: '/v1/joint-accounts/sign-requests/mark-confirmed/',
        data: params,
    })
}
