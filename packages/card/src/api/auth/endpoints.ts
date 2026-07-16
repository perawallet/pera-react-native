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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type { CardSessionTokens, LoginResult } from '../../models'
import { loginResponseSchema, tokenResponseSchema } from './schema'
import { transformLoginResponse, transformTokenResponse } from './transformers'

export type LoginRequestParams = {
    email: string
    password: string
    otpCode?: string
    network: Network
    signal?: AbortSignal
}

export const loginRequest = async (
    params: LoginRequestParams,
): Promise<LoginResult> => {
    const { email, password, otpCode, network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/auth/login',
        data: { email, password, ...(otpCode ? { otpCode } : {}) },
        signal,
    })

    return transformLoginResponse(loginResponseSchema.parse(response.data))
}

export type RefreshTokenRequestParams = {
    refreshToken: string
    network: Network
    signal?: AbortSignal
}

/**
 * Exchanges the refresh token for a fresh access token. Routed through Pera's
 * backend (`proxy`) since the OAuth token endpoint requires the x-secret-key.
 */
export const refreshTokenRequest = async (
    params: RefreshTokenRequestParams,
): Promise<CardSessionTokens> => {
    const { refreshToken, network, signal } = params

    const response = await getCardTransport().request({
        route: 'proxy',
        network,
        method: 'POST',
        path: '/v1/auth/oauth/token',
        data: { grant_type: 'refresh_token', refresh_token: refreshToken },
        signal,
    })

    return transformTokenResponse(tokenResponseSchema.parse(response.data))
}
