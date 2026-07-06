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
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    delegationTokenResponseSchema,
    externalWalletsResponseSchema,
    type ExternalWalletApiResponse,
} from './schema'

export type MockGetDelegationTokenParams = {
    token?: string
    nonce?: string
    status?: number
}

export const mockGetDelegationToken = ({
    token = 'test-delegation-token',
    nonce = 'dGVzdC1ub25jZQ==',
    status = 200,
}: MockGetDelegationTokenParams = {}): HttpHandler => {
    const response = { token, nonce }
    validateMockResponse(
        delegationTokenResponseSchema,
        response,
        'mockGetDelegationToken',
    )
    return http.get('*/v1/delegation/token', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockGetDelegationProgramParams = {
    /** Base64 compiled program blob. */
    program?: string
    status?: number
}

export const mockGetDelegationProgram = ({
    program = 'BIEB',
    status = 200,
}: MockGetDelegationProgramParams = {}): HttpHandler =>
    http.get('*/v1/delegation/chain/config', () =>
        HttpResponse.json({ program }, { status }),
    )

export type MockPostAlgorandDelegationApprovalParams = {
    status?: number
    /** Captures each request body for assertions. */
    onRequest?: (body: Record<string, unknown>) => void
}

export const mockPostAlgorandDelegationApproval = ({
    status = 200,
    onRequest,
}: MockPostAlgorandDelegationApprovalParams = {}): HttpHandler =>
    http.post('*/v1/delegation/algorand/post-approval', async ({ request }) => {
        onRequest?.((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ success: status < 400 }, { status })
    })

export type MockGetExternalWalletsParams = {
    response: ExternalWalletApiResponse[]
    status?: number
}

export const mockGetExternalWallets = ({
    response,
    status = 200,
}: MockGetExternalWalletsParams): HttpHandler => {
    validateMockResponse(
        externalWalletsResponseSchema,
        response,
        'mockGetExternalWallets',
    )
    return http.get('*/v1/wallet/external', () =>
        HttpResponse.json(response, { status }),
    )
}
