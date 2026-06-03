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

import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * In-memory holder for the current Baanx access token. The durable copy lives
 * in the encrypted KMS keystore; this cache exists so the HTTP `beforeRequest`
 * hook can attach the Bearer synchronously without an async keystore read on
 * every request. Hydrated once at bootstrap and cleared on logout / app kill.
 * The refresh token is intentionally NOT cached here — it is read from the
 * keystore only during a refresh.
 */
type TokenCache = {
    accessToken: Nullable<string>
    /** Epoch ms. */
    expiresAt: Nullable<number>
}

let cache: TokenCache = { accessToken: null, expiresAt: null }

export const getAccessToken = (): Nullable<string> => cache.accessToken

export const getTokenExpiry = (): Nullable<number> => cache.expiresAt

export const setCachedAccessToken = (
    accessToken: string,
    expiresAt: number,
): void => {
    cache = { accessToken, expiresAt }
}

export const clearTokenCache = (): void => {
    cache = { accessToken: null, expiresAt: null }
}
