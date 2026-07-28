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

import { toEnumValueOrNull } from '@perawallet/wallet-core-shared'
import {
    OnboardingPhase,
    VerificationState,
    type CardSessionTokens,
    type LoginResult,
    type OauthAuthorization,
    type OauthInitiation,
} from '../../models'
import type {
    LoginApiResponse,
    OauthAuthorizeApiResponse,
    OauthInitiateApiResponse,
    TokenApiResponse,
} from './schema'

export const transformLoginResponse = (
    response: LoginApiResponse,
): LoginResult => ({
    accessToken: response.accessToken ?? null,
    userId: response.userId ?? null,
    isOtpRequired: response.isOtpRequired ?? false,
    phase: toEnumValueOrNull(OnboardingPhase, response.phase),
    verificationState: toEnumValueOrNull(
        VerificationState,
        response.verificationState,
    ),
    isLinked: response.isLinked ?? false,
})

export const transformTokenResponse = (
    response: TokenApiResponse,
): CardSessionTokens => ({
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
})

export const transformOauthInitiateResponse = (
    response: OauthInitiateApiResponse,
): OauthInitiation => ({
    sessionToken: response.token,
})

export const transformOauthAuthorizeResponse = (
    response: OauthAuthorizeApiResponse,
): OauthAuthorization => ({
    code: response.code,
    state: response.state,
})
