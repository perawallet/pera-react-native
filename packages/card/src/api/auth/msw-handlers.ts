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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    loginResponseSchema,
    tokenResponseSchema,
    type LoginApiResponse,
    type TokenApiResponse,
} from './schema'

export type MockLoginParams = {
    response: LoginApiResponse
    status?: number
}

export const mockLogin = ({
    response,
    status = 200,
}: MockLoginParams): HttpHandler => {
    validateMockResponse(loginResponseSchema, response, 'mockLogin')
    return http.post('*/v1/auth/login', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockRefreshTokenParams = {
    response: TokenApiResponse
    status?: number
}

export const mockRefreshToken = ({
    response,
    status = 200,
}: MockRefreshTokenParams): HttpHandler => {
    validateMockResponse(tokenResponseSchema, response, 'mockRefreshToken')
    return http.post('*/v1/auth/oauth/token', () =>
        HttpResponse.json(response, { status }),
    )
}
