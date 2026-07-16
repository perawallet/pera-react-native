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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAppIntegrityStore } from '../store'

/**
 * The current non-expired device attestation token, or null when absent or
 * expired. Read synchronously from the store snapshot so callers decide at
 * call time, not render time — pass it as the `x-app-integrity-token` header
 * on integrity-guarded backend routes.
 */
export const getValidIntegrityToken = (): Nullable<string> => {
    const { integrityToken, expiresAt } = useAppIntegrityStore.getState()
    if (!integrityToken || !expiresAt) {
        return null
    }
    const expiry = Date.parse(expiresAt)
    return Number.isFinite(expiry) && expiry > Date.now()
        ? integrityToken
        : null
}
