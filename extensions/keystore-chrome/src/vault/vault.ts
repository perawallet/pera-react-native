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

import { base64 } from '@scure/base'
import {
    InvalidPasswordError,
    VaultCorruptedError,
    VaultExistsError,
    VaultLockedOutError,
    VaultNotInitializedError,
} from '../errors'
import {
    PRF_BLOB_KEY,
    PRF_CRED_ID_KEY,
    VAULT_STORAGE_KEY,
} from '../storage-keys'
import { armAutoLock, disarmAutoLock } from './autolock'
import {
    clearFailedAttempts,
    getLockoutRemainingSeconds,
    recordFailedAttempt,
} from './lockout'
import {
    clearSessionMasterKey,
    hasSessionMasterKey,
    putSessionMasterKey,
    SESSION_MASTER_KEY,
} from './session'

// MetaMask-parity floor per the design spec. Argon2id is the noted upgrade
// path (would ship as version: 2 blobs).
export const PBKDF2_ITERATIONS = 600_000

// ~17x the floor; anything above is corruption or DoS, not a legitimate
// blob. Unlock derives a key at `blob.iterations`, so an unbounded value lets
// a corrupted (or maliciously written) blob make unlock take arbitrarily
// long — this ceiling turns that into an immediate VaultCorruptedError.
export const PBKDF2_MAX_ITERATIONS = 10_000_000

type WrappedMasterKeyV1 = {
    version: 1
    kdf: 'PBKDF2-SHA256'
    iterations: number
    salt: string
    iv: string
    ciphertext: string
}

const isValidBlob = (x: unknown): x is WrappedMasterKeyV1 =>
    typeof x === 'object' &&
    x !== null &&
    (x as WrappedMasterKeyV1).version === 1 &&
    (x as WrappedMasterKeyV1).kdf === 'PBKDF2-SHA256' &&
    typeof (x as WrappedMasterKeyV1).salt === 'string' &&
    typeof (x as WrappedMasterKeyV1).iv === 'string' &&
    typeof (x as WrappedMasterKeyV1).ciphertext === 'string' &&
    Number.isSafeInteger((x as WrappedMasterKeyV1).iterations) &&
    (x as WrappedMasterKeyV1).iterations >= PBKDF2_ITERATIONS &&
    (x as WrappedMasterKeyV1).iterations <= PBKDF2_MAX_ITERATIONS

const deriveKek = async (
    password: string,
    salt: Uint8Array,
    iterations: number,
): Promise<CryptoKey> => {
    const passwordBytes = new TextEncoder().encode(password)
    try {
        const material = await crypto.subtle.importKey(
            'raw',
            passwordBytes,
            'PBKDF2',
            false,
            ['deriveKey'],
        )
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: salt as BufferSource,
                iterations,
            },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        )
    } finally {
        passwordBytes.fill(0)
    }
}

const readWrappedMasterKey = async (): Promise<WrappedMasterKeyV1> => {
    const stored = await chrome.storage.local.get(VAULT_STORAGE_KEY)
    const raw = stored[VAULT_STORAGE_KEY]
    if (typeof raw !== 'string') {
        throw new VaultNotInitializedError(
            'No vault exists. Create one with createVault() first.',
        )
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new VaultCorruptedError()
    }
    if (!isValidBlob(parsed)) {
        throw new VaultCorruptedError()
    }
    return parsed
}

const writeWrappedMasterKey = async (
    password: string,
    masterKey: Uint8Array,
): Promise<void> => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const kek = await deriveKek(password, salt, PBKDF2_ITERATIONS)
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            kek,
            masterKey as BufferSource,
        ),
    )
    const blob: WrappedMasterKeyV1 = {
        version: 1,
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        salt: base64.encode(salt),
        iv: base64.encode(iv),
        ciphertext: base64.encode(ciphertext),
    }
    await chrome.storage.local.set({
        [VAULT_STORAGE_KEY]: JSON.stringify(blob),
    })
}

// Exported for use by passkey.ts to verify the password and obtain the master
// key when enabling passkey unlock. Not part of the public package API.
export const unwrapMasterKeyWithPassword = async (
    password: string,
): Promise<Uint8Array> => unwrapMasterKey(password)

const unwrapMasterKey = async (password: string): Promise<Uint8Array> => {
    const blob = await readWrappedMasterKey()

    // Decode outside the GCM try/catch — decode failures are corruption, not wrong password.
    let saltBytes: Uint8Array
    let ivBytes: Uint8Array
    let ciphertextBytes: Uint8Array
    try {
        saltBytes = base64.decode(blob.salt)
        ivBytes = base64.decode(blob.iv)
        ciphertextBytes = base64.decode(blob.ciphertext)
    } catch {
        throw new VaultCorruptedError()
    }

    // writeWrappedMasterKey always writes a 16-byte salt / 12-byte IV — any
    // other decoded length is corruption, never a wrong password.
    if (saltBytes.length !== 16 || ivBytes.length !== 12) {
        throw new VaultCorruptedError()
    }

    const kek = await deriveKek(password, saltBytes, blob.iterations)
    try {
        return new Uint8Array(
            await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBytes as BufferSource },
                kek,
                ciphertextBytes as BufferSource,
            ),
        )
    } catch {
        // AES-GCM auth failure — the only way to distinguish a wrong password.
        throw new InvalidPasswordError('Invalid password.')
    }
}

export const isVaultInitialized = async (): Promise<boolean> => {
    const stored = await chrome.storage.local.get(VAULT_STORAGE_KEY)
    return typeof stored[VAULT_STORAGE_KEY] === 'string'
}

export const createVault = async (password: string): Promise<void> => {
    if (await isVaultInitialized()) {
        throw new VaultExistsError('A vault already exists.')
    }
    const masterKey = crypto.getRandomValues(new Uint8Array(32))
    try {
        await writeWrappedMasterKey(password, masterKey)
        // Evict any stale PRF blob so a re-created vault cannot be opened
        // with a passkey that was wrapping the previous master key.
        // Keys are imported from storage-keys.ts (rather than calling
        // disablePasskeyUnlock) to avoid a circular import between
        // vault.ts ↔ passkey.ts.
        await chrome.storage.local.remove([PRF_BLOB_KEY, PRF_CRED_ID_KEY])
        await putSessionMasterKey(masterKey)
        await armAutoLock()
    } finally {
        masterKey.fill(0)
    }
}

export const unlockVault = async (password: string): Promise<void> => {
    const remainingSeconds = await getLockoutRemainingSeconds()
    if (remainingSeconds > 0) throw new VaultLockedOutError(remainingSeconds)

    let masterKey: Uint8Array
    try {
        masterKey = await unwrapMasterKey(password)
    } catch (error) {
        if (error instanceof InvalidPasswordError) await recordFailedAttempt()
        throw error
    }
    try {
        await putSessionMasterKey(masterKey)
        await armAutoLock()
        await clearFailedAttempts()
    } finally {
        masterKey.fill(0)
    }
}

export const lockVault = async (): Promise<void> => {
    await disarmAutoLock()
    await clearSessionMasterKey()
}

export const isUnlocked = async (): Promise<boolean> => {
    return hasSessionMasterKey()
}

export const changePassword = async (
    currentPassword: string,
    nextPassword: string,
): Promise<void> => {
    const masterKey = await unwrapMasterKey(currentPassword)
    try {
        await writeWrappedMasterKey(nextPassword, masterKey)
    } finally {
        masterKey.fill(0)
    }
}

/**
 * Subscribes to lock-state transitions across ALL extension contexts (the
 * popup learns when the background auto-lock fires, and vice versa).
 * Returns an unsubscribe function.
 */
export const onLockStateChanged = (
    listener: (isUnlocked: boolean) => void,
): (() => void) => {
    const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
    ): void => {
        if (areaName !== 'session') return
        const change = changes[SESSION_MASTER_KEY]
        if (!change) return
        listener(change.newValue !== undefined)
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
}
