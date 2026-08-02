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

// Pure parser for the settings store's persisted envelope, which lands in
// chrome.storage.local as a JSON *string* under `kv:settings-store`. Kept
// side-effect-free so it's usable from the ISOLATED relay and unit-testable
// without a chrome fake.
//
// Defaults OFF on every failure mode — this is opt-in, and Pera must never
// silently hijack WebAuthn.
export const SETTINGS_STORE_KV_KEY = 'kv:settings-store'
export const WEBAUTHN_TOGGLE_PREFERENCE_KEY = 'webauthnInterceptionEnabled'

export const parseWebauthnInterceptionEnabled = (
    raw: string | undefined,
): boolean => {
    if (raw === undefined) return false
    let envelope: unknown
    try {
        envelope = JSON.parse(raw)
    } catch {
        return false
    }
    const preferences = (
        envelope as {
            state?: { preferences?: Record<string, unknown> }
        } | null
    )?.state?.preferences
    return preferences?.[WEBAUTHN_TOGGLE_PREFERENCE_KEY] === true
}
