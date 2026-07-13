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

export const SESSION_MASTER_KEY = 'vault:master-key'

// JS strings are immutable heap copies until GC, so .fill(0) on the byte
// arrays below is best-effort, not a complete guarantee — inherent to
// chrome.storage.session's JSON-value design.
const toHex = (bytes: Uint8Array): string =>
    [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')

const fromHex = (hex: string): Uint8Array =>
    new Uint8Array(hex.match(/.{2}/g)?.map(pair => parseInt(pair, 16)) ?? [])

let accessLevelSet = false

const ensureAccessLevel = async (): Promise<void> => {
    if (accessLevelSet) return
    try {
        // Memory-only and readable ONLY from trusted extension contexts —
        // never content scripts.
        await chrome.storage.session.setAccessLevel({
            accessLevel: 'TRUSTED_CONTEXTS',
        })
    } catch {
        // Older Chromium without setAccessLevel: TRUSTED_CONTEXTS is already
        // the default access level, so proceeding is safe.
    }
    accessLevelSet = true
}

export const putSessionMasterKey = async (key: Uint8Array): Promise<void> => {
    await ensureAccessLevel()
    await chrome.storage.session.set({ [SESSION_MASTER_KEY]: toHex(key) })
}

export const getSessionMasterKey = async (): Promise<Uint8Array | null> => {
    const stored = await chrome.storage.session.get(SESSION_MASTER_KEY)
    const raw = stored[SESSION_MASTER_KEY]
    return typeof raw === 'string' && raw.length === 64 ? fromHex(raw) : null
}

export const clearSessionMasterKey = async (): Promise<void> => {
    await chrome.storage.session.remove(SESSION_MASTER_KEY)
}

export const hasSessionMasterKey = async (): Promise<boolean> => {
    const stored = await chrome.storage.session.get(SESSION_MASTER_KEY)
    return typeof stored[SESSION_MASTER_KEY] === 'string'
}
