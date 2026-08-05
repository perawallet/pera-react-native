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

import { INTEGRITY_TOKEN_SESSION_KEY } from './storage-keys'

export { INTEGRITY_TOKEN_SESSION_KEY }

/**
 * `mintedAt` is ours, not the backend's: the attest response carries only
 * `expiresAt`, and "renew at 60% of TTL" needs the start of the window.
 */
export type SessionIntegrityToken = {
    integrityToken: string
    expiresAt: string
    mintedAt: string
    deviceInstallationId: string
}

let accessLevelSet = false

const ensureAccessLevel = async (): Promise<void> => {
    if (accessLevelSet) return
    try {
        await chrome.storage.session.setAccessLevel({
            accessLevel: 'TRUSTED_CONTEXTS',
        })
    } catch {
        // Older Chromium without setAccessLevel: TRUSTED_CONTEXTS is already
        // the default access level, so proceeding is safe.
    }
    accessLevelSet = true
}

const isSessionIntegrityToken = (
    value: unknown,
): value is SessionIntegrityToken => {
    const candidate = value as Partial<SessionIntegrityToken> | null
    return (
        typeof candidate?.integrityToken === 'string' &&
        typeof candidate.expiresAt === 'string' &&
        typeof candidate.mintedAt === 'string' &&
        typeof candidate.deviceInstallationId === 'string'
    )
}

export const putSessionIntegrityToken = async (
    token: SessionIntegrityToken,
): Promise<void> => {
    await ensureAccessLevel()
    await chrome.storage.session.set({ [INTEGRITY_TOKEN_SESSION_KEY]: token })
}

export const getSessionIntegrityToken =
    async (): Promise<SessionIntegrityToken | null> => {
        const stored = await chrome.storage.session.get(
            INTEGRITY_TOKEN_SESSION_KEY,
        )
        const value = stored[INTEGRITY_TOKEN_SESSION_KEY]
        return isSessionIntegrityToken(value) ? value : null
    }

export const clearSessionIntegrityToken = async (): Promise<void> => {
    await chrome.storage.session.remove(INTEGRITY_TOKEN_SESSION_KEY)
}
