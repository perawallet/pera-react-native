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

import { PASSWORD_AUTH_AT_KEY } from '../storage-keys'

/** How long after a proven password the session master key may be wrapped for passkey unlock without asking again. */
export const PASSKEY_ENABLE_REAUTH_WINDOW_MS = 10 * 60_000

// Date.now(), not performance.now(): the popup and the expanded tab are
// separate realms whose monotonic clocks share no origin.
export const stampPasswordAuth = async (): Promise<void> => {
    await chrome.storage.session.set({ [PASSWORD_AUTH_AT_KEY]: Date.now() })
}

export const clearPasswordAuth = async (): Promise<void> => {
    await chrome.storage.session.remove(PASSWORD_AUTH_AT_KEY)
}

export const hasRecentPasswordAuth = async (): Promise<boolean> => {
    const stored = await chrome.storage.session.get(PASSWORD_AUTH_AT_KEY)
    const at = stored[PASSWORD_AUTH_AT_KEY]
    if (typeof at !== 'number') return false
    const elapsed = Date.now() - at
    // A negative elapsed means the clock moved back; fail towards the password.
    return elapsed >= 0 && elapsed <= PASSKEY_ENABLE_REAUTH_WINDOW_MS
}
