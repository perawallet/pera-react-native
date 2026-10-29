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

import type { Optional, Nullable, Maybe } from '@perawallet/wallet-core-shared'

/**
 * The `code` from a Pera error body such as `{ error, code }`. ky pre-parses
 * the body onto its HTTPError's `data` and consumes the response, and
 * queryClient keeps that error as the PeraNetworkError's `originalError`, so
 * that is the only place the body survives.
 */
export const readIntegrityErrorCode = (error: unknown): Optional<string> => {
    const candidates = [
        error,
        (error as Nullable<{ originalError?: unknown }>)?.originalError,
    ]
    for (const candidate of candidates) {
        const data = (candidate as Nullable<{ data?: unknown }>)?.data
        const code = (data as Maybe<{ code?: unknown }>)?.code
        if (typeof code === 'string') return code
    }
    return undefined
}
