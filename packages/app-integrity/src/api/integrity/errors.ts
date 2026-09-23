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

/**
 * The `code` from a Pera error body such as `{ error, code }`. ky pre-parses
 * the body onto its HTTPError's `data` and consumes the response, and
 * queryClient keeps that error as the PeraNetworkError's `originalError`, so
 * that is the only place the body survives.
 */
export const readIntegrityErrorCode = (error: unknown): string | undefined => {
    const candidates = [
        error,
        (error as { originalError?: unknown } | null)?.originalError,
    ]
    for (const candidate of candidates) {
        const data = (candidate as { data?: unknown } | null)?.data
        const code = (data as { code?: unknown } | null | undefined)?.code
        if (typeof code === 'string') return code
    }
    return undefined
}
