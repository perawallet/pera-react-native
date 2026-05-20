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

import { http, HttpResponse, type HttpHandler } from 'msw'
import {
    validateMockRequest,
    validateMockResponse,
} from '@perawallet/wallet-core-shared/test-utils'
import {
    addSignatureRequestSchema,
    createMultisigAccountRequestSchema,
    createMultisigAccountResponseSchema,
    getSignRequestsWithSignaturesRequestSchema,
    getSignRequestsWithSignaturesResponseSchema,
    markSignRequestsConfirmedRequestSchema,
    proposeSignRequestResponseSchema,
    proposeSignRequestSchema,
    type CreateMultisigAccountResponse,
    type GetSignRequestsWithSignaturesResponse,
    type ProposeSignRequestResponse,
} from './schema'

export type MockCreateMultisigAccountParams = {
    response: CreateMultisigAccountResponse
    status?: number
}

export const mockCreateMultisigAccount = ({
    response,
    status = 200,
}: MockCreateMultisigAccountParams): HttpHandler => {
    validateMockResponse(
        createMultisigAccountResponseSchema,
        response,
        'mockCreateMultisigAccount',
    )
    return http.post('*/v1/joint-accounts/accounts/', async ({ request }) => {
        const validated = await validateMockRequest(
            createMultisigAccountRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

export type MockGetMultisigAccountDetailParams = {
    address: string
    response: CreateMultisigAccountResponse
    status?: number
}

export const mockGetMultisigAccountDetail = ({
    address,
    response,
    status = 200,
}: MockGetMultisigAccountDetailParams): HttpHandler => {
    validateMockResponse(
        createMultisigAccountResponseSchema,
        response,
        'mockGetMultisigAccountDetail',
    )
    return http.get(`*/v1/joint-accounts/accounts/${address}/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockProposeSignRequestParams = {
    response: ProposeSignRequestResponse
    status?: number
}

export const mockProposeSignRequest = ({
    response,
    status = 200,
}: MockProposeSignRequestParams): HttpHandler => {
    validateMockResponse(
        proposeSignRequestResponseSchema,
        response,
        'mockProposeSignRequest',
    )
    return http.post(
        '*/v1/joint-accounts/sign-requests/',
        async ({ request }) => {
            const validated = await validateMockRequest(
                proposeSignRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(response, { status })
        },
    )
}

export type MockAddSignatureParams = {
    signRequestId: string
    response: ProposeSignRequestResponse
    status?: number
}

export const mockAddSignature = ({
    signRequestId,
    response,
    status = 200,
}: MockAddSignatureParams): HttpHandler => {
    validateMockResponse(
        proposeSignRequestResponseSchema,
        response,
        'mockAddSignature',
    )
    return http.post(
        `*/v1/joint-accounts/sign-requests/${signRequestId}/responses/`,
        async ({ request }) => {
            // The endpoint accepts an array of signature payloads.
            const validated = await validateMockRequest(
                addSignatureRequestSchema.array(),
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(response, { status })
        },
    )
}

export type MockGetSignRequestsWithSignaturesParams = {
    response: GetSignRequestsWithSignaturesResponse
    status?: number
}

export const mockGetSignRequestsWithSignatures = ({
    response,
    status = 200,
}: MockGetSignRequestsWithSignaturesParams): HttpHandler => {
    validateMockResponse(
        getSignRequestsWithSignaturesResponseSchema,
        response,
        'mockGetSignRequestsWithSignatures',
    )
    return http.post(
        '*/v1/joint-accounts/sign-requests/with-signatures/',
        async ({ request }) => {
            const validated = await validateMockRequest(
                getSignRequestsWithSignaturesRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(response, { status })
        },
    )
}

export type MockMarkSignRequestsConfirmedParams = {
    status?: number
}

export const mockMarkSignRequestsConfirmed = ({
    status = 204,
}: MockMarkSignRequestsConfirmedParams = {}): HttpHandler =>
    http.post(
        '*/v1/joint-accounts/sign-requests/mark-confirmed/',
        async ({ request }) => {
            const validated = await validateMockRequest(
                markSignRequestsConfirmedRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return new HttpResponse(null, { status })
        },
    )

export type MockDeleteMultisigImportInboxParams = {
    deviceId: string
    multisigAddress: string
    status?: number
}

export const mockDeleteMultisigImportInbox = ({
    deviceId,
    multisigAddress,
    status = 204,
}: MockDeleteMultisigImportInboxParams): HttpHandler =>
    http.delete(
        `*/v1/joint-accounts/inbox/device-import/${deviceId}/${multisigAddress}/`,
        () => new HttpResponse(null, { status }),
    )
