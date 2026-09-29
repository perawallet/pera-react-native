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

import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getValidIntegrityToken } from './getValidIntegrityToken'

export const INTEGRITY_TOKEN_HEADER = 'x-app-integrity-token'
export const INTEGRITY_BYPASS_HEADER = 'x-bypass-integrity'
const INTEGRITY_BYPASS_VALUE = 'DEVELOPMENT_AND_STAGING_ONLY'

// Named allow-list rather than `!== 'production'`, so a new variant never
// inherits the bypass by default.
const isBypassEnvironment = (): boolean =>
    config.appEnvironment === 'development' ||
    config.appEnvironment === 'staging'

/**
 * The headers for a request to an app-integrity-guarded Pera backend route
 * (`/api/v3/baanx/*`, `/api/v3/fee-delegation`). Apply once per request.
 *
 * Dev and staging builds always add the bypass header, even alongside a token:
 * the backend checks the bypass first, and a web-minted token in the store is
 * refused by guarded routes, so dropping the bypass whenever a token exists
 * would break those builds. The header is a public opt-in string; the backend's
 * own env flag is the real gate. Production never sends it.
 */
export const buildIntegrityHeaders = (
    token: Nullable<string> = getValidIntegrityToken(),
): Record<string, string> => ({
    ...(token ? { [INTEGRITY_TOKEN_HEADER]: token } : {}),
    ...(isBypassEnvironment()
        ? { [INTEGRITY_BYPASS_HEADER]: INTEGRITY_BYPASS_VALUE }
        : {}),
})

/**
 * False only when the guarded route is certain to refuse the call: a
 * production build with no valid token. Lets a flow fail with its own typed
 * error before spending network calls or a signature.
 */
export const canCallIntegrityGuardedRoute = (
    token: Nullable<string> = getValidIntegrityToken(),
): boolean => Boolean(token) || isBypassEnvironment()
