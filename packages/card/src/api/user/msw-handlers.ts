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
    userResponseSchema,
    verificationSessionResponseSchema,
    type UserApiResponse,
    type VerificationSessionApiResponse,
} from './schema'

export type MockGetUserParams = {
    response: UserApiResponse
    status?: number
}

export const mockGetUser = ({
    response,
    status = 200,
}: MockGetUserParams): HttpHandler => {
    validateMockResponse(userResponseSchema, response, 'mockGetUser')
    return http.get('*/v1/user', () => HttpResponse.json(response, { status }))
}

export type MockGetVerificationSessionParams = {
    response: VerificationSessionApiResponse
    status?: number
}

export const mockGetVerificationSession = ({
    response,
    status = 200,
}: MockGetVerificationSessionParams): HttpHandler => {
    validateMockResponse(
        verificationSessionResponseSchema,
        response,
        'mockGetVerificationSession',
    )
    return http.get('*/v1/user/verification', () =>
        HttpResponse.json(response, { status }),
    )
}
