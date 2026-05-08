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
import type {
    CreateMultisigAccountResponse,
    ProposeSignRequestResponse,
    SignRequestDetailResponse,
} from './schema'

export type MockCreateMultisigAccountParams = {
    response: CreateMultisigAccountResponse
    status?: number
}

export const mockCreateMultisigAccount = ({
    response,
    status = 200,
}: MockCreateMultisigAccountParams): HttpHandler =>
    http.post('*/v1/joint-accounts/accounts/', () =>
        HttpResponse.json(response, { status }),
    )

export type MockGetMultisigAccountDetailParams = {
    address: string
    response: CreateMultisigAccountResponse
    status?: number
}

export const mockGetMultisigAccountDetail = ({
    address,
    response,
    status = 200,
}: MockGetMultisigAccountDetailParams): HttpHandler =>
    http.get(`*/v1/joint-accounts/accounts/${address}/`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockProposeSignRequestParams = {
    response: ProposeSignRequestResponse
    status?: number
}

export const mockProposeSignRequest = ({
    response,
    status = 200,
}: MockProposeSignRequestParams): HttpHandler =>
    http.post('*/v1/joint-accounts/sign-requests/', () =>
        HttpResponse.json(response, { status }),
    )

export type MockAddSignatureParams = {
    signRequestId: string
    response: ProposeSignRequestResponse
    status?: number
}

export const mockAddSignature = ({
    signRequestId,
    response,
    status = 200,
}: MockAddSignatureParams): HttpHandler =>
    http.post(
        `*/v1/joint-accounts/sign-requests/${signRequestId}/responses/`,
        () => HttpResponse.json(response, { status }),
    )

export type MockGetSignRequestDetailParams = {
    signRequestId: string
    response: SignRequestDetailResponse
    status?: number
}

export const mockGetSignRequestDetail = ({
    signRequestId,
    response,
    status = 200,
}: MockGetSignRequestDetailParams): HttpHandler =>
    http.get(
        `*/v1/joint-accounts/sign-requests/${signRequestId}/with-signatures/`,
        () => HttpResponse.json(response, { status }),
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
