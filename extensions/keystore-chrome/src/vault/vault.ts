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

import { argon2id } from '@noble/hashes/argon2.js'
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

// PBKDF2 parameters for reading legacy `version: 1` blobs. No longer written —
// see the Argon2id parameters below for why.
export const PBKDF2_ITERATIONS = 600_000

// ~17x the floor; anything above is corruption or DoS, not a legitimate
// blob. Unlock derives a key at `blob.iterations`, so an unbounded value lets
// a corrupted (or maliciously written) blob make unlock take arbitrarily
// long — this ceiling turns that into an immediate VaultCorruptedError.
export const PBKDF2_MAX_ITERATIONS = 10_000_000

/**
 * Argon2id parameters for `version: 2` blobs — OWASP's baseline recommendation
 * (19 MiB, t=2, p=1).
 *
 * Why this replaced PBKDF2: the wrapped master key sits in
 * `chrome.storage.local`, i.e. a readable file in the browser profile. An
 * attacker who copies that directory (infostealer, backup, stolen or shared
 * machine) attacks it entirely offline, where the in-extension lockout is
 * irrelevant and only the KDF's cost stands between them and a human-chosen
 * password. PBKDF2-SHA256 is the most GPU-friendly of the mainstream KDFs;
 * Argon2id is memory-hard, which is what actually blunts GPU and ASIC
 * parallelism.
 *
 * Measured ~260ms in node and comfortably under a second in-browser — the
 * cost lands on unlock, once per session.
 */
export const ARGON2_MEMORY_KIB = 19_456
export const ARGON2_ITERATIONS = 2
export const ARGON2_PARALLELISM = 1

// Same DoS reasoning as PBKDF2_MAX_ITERATIONS, and more acute: `m` is a real
// memory allocation, so an unbounded value from a corrupted or maliciously
// written blob is an OOM rather than just a slow unlock.
const ARGON2_MAX_MEMORY_KIB = 262_144 // 256 MiB
const ARGON2_MAX_ITERATIONS = 16

type WrappedMasterKeyV1 = {
    version: 1
    kdf: 'PBKDF2-SHA256'
    iterations: number
    salt: string
    iv: string
    ciphertext: string
}

type WrappedMasterKeyV2 = {
    version: 2
    kdf: 'Argon2id'
    /** Memory cost in KiB. */
    m: number
    /** Time cost (passes). */
    t: number
    /** Parallelism (lanes). */
    p: number
    salt: string
    iv: string
    ciphertext: string
}

type WrappedMasterKey = WrappedMasterKeyV1 | WrappedMasterKeyV2

const hasEnvelopeStrings = (x: Record<string, unknown>): boolean =>
    typeof x.salt === 'string' &&
    typeof x.iv === 'string' &&
    typeof x.ciphertext === 'string'

// Bounds are BOTH floor and ceiling on purpose. The ceiling stops a hostile
// blob from turning unlock into a hang or an OOM; the floor stops a downgrade
// — an attacker with write access to the profile could otherwise rewrite the
// blob's own cost parameters down to 1 and brute-force what is then a
// near-unprotected password.
const isValidV1 = (x: Record<string, unknown>): x is WrappedMasterKeyV1 =>
    x.version === 1 &&
    x.kdf === 'PBKDF2-SHA256' &&
    hasEnvelopeStrings(x) &&
    Number.isSafeInteger(x.iterations) &&
    (x.iterations as number) >= PBKDF2_ITERATIONS &&
    (x.iterations as number) <= PBKDF2_MAX_ITERATIONS

const isValidV2 = (x: Record<string, unknown>): x is WrappedMasterKeyV2 =>
    x.version === 2 &&
    x.kdf === 'Argon2id' &&
    hasEnvelopeStrings(x) &&
    Number.isSafeInteger(x.m) &&
    Number.isSafeInteger(x.t) &&
    Number.isSafeInteger(x.p) &&
    (x.m as number) >= ARGON2_MEMORY_KIB &&
    (x.m as number) <= ARGON2_MAX_MEMORY_KIB &&
    (x.t as number) >= ARGON2_ITERATIONS &&
    (x.t as number) <= ARGON2_MAX_ITERATIONS &&
    (x.p as number) >= ARGON2_PARALLELISM &&
    (x.p as number) <= 4

const isValidBlob = (x: unknown): x is WrappedMasterKey => {
    if (typeof x !== 'object' || x === null) return false
    const candidate = x as Record<string, unknown>
    return isValidV1(candidate) || isValidV2(candidate)
}

const importAesKey = (raw: Uint8Array): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
        'encrypt',
        'decrypt',
    ])

const deriveKekPbkdf2 = async (
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

const deriveKekArgon2 = async (
    password: string,
    salt: Uint8Array,
    params: { m: number; t: number; p: number },
): Promise<CryptoKey> => {
    const passwordBytes = new TextEncoder().encode(password)
    let derived: Uint8Array | undefined
    try {
        derived = argon2id(passwordBytes, salt, {
            m: params.m,
            t: params.t,
            p: params.p,
            dkLen: 32,
        })
        return await importAesKey(derived)
    } finally {
        passwordBytes.fill(0)
        derived?.fill(0)
    }
}

/** Derives the key-encryption key using whichever KDF the blob was written with. */
const deriveKekForBlob = (
    password: string,
    blob: WrappedMasterKey,
    salt: Uint8Array,
): Promise<CryptoKey> =>
    blob.version === 2
        ? deriveKekArgon2(password, salt, blob)
        : deriveKekPbkdf2(password, salt, blob.iterations)

const readWrappedMasterKey = async (): Promise<WrappedMasterKey> => {
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
    // Always v2: v1 is read-only legacy, migrated on the next successful
    // unlock (see migrateBlobIfLegacy).
    const kek = await deriveKekArgon2(password, salt, {
        m: ARGON2_MEMORY_KIB,
        t: ARGON2_ITERATIONS,
        p: ARGON2_PARALLELISM,
    })
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            kek,
            masterKey as BufferSource,
        ),
    )
    const blob: WrappedMasterKeyV2 = {
        version: 2,
        kdf: 'Argon2id',
        m: ARGON2_MEMORY_KIB,
        t: ARGON2_ITERATIONS,
        p: ARGON2_PARALLELISM,
        salt: base64.encode(salt),
        iv: base64.encode(iv),
        ciphertext: base64.encode(ciphertext),
    }
    await chrome.storage.local.set({
        [VAULT_STORAGE_KEY]: JSON.stringify(blob),
    })
}

/**
 * Unwraps under the same brute-force throttle `unlockVault` uses.
 *
 * EVERY password check must go through here, not `unwrapMasterKey` directly.
 * The lockout is the only thing bounding an online guessing run, and a single
 * un-throttled entry point re-opens the whole door: `changePassword` and
 * `enablePasskeyUnlock` both used to check the password without consulting or
 * recording an attempt, which made them unmetered password oracles for anyone
 * with a briefly-unattended unlocked profile. PBKDF2's cost was the only brake.
 *
 * On success the caller owns the returned key and MUST zero it.
 */
const unwrapMasterKeyThrottled = async (
    password: string,
): Promise<Uint8Array> => {
    const remainingSeconds = await getLockoutRemainingSeconds()
    if (remainingSeconds > 0) throw new VaultLockedOutError(remainingSeconds)

    let masterKey: Uint8Array
    try {
        masterKey = await unwrapMasterKey(password)
    } catch (error) {
        // Only a genuine wrong password counts — VaultCorruptedError must not
        // burn attempts, or a corrupt blob would lock the user out for good.
        if (error instanceof InvalidPasswordError) await recordFailedAttempt()
        throw error
    }
    await clearFailedAttempts()
    return masterKey
}

// Exported for use by passkey.ts to verify the password and obtain the master
// key when enabling passkey unlock. Not part of the public package API.
// Throttled: enabling passkey unlock is a password check like any other.
export const unwrapMasterKeyWithPassword = async (
    password: string,
): Promise<Uint8Array> => unwrapMasterKeyThrottled(password)

/**
 * Confirms `password` is the vault password, without unlocking anything or
 * touching the session key. For re-authenticating a already-unlocked user
 * before a high-consequence action — revealing a recovery phrase, or asserting
 * a WebAuthn credential to a relying party that asked for user verification.
 *
 * Returns false on a wrong password; throws {@link VaultLockedOutError} while
 * throttled so the caller can show the remaining time rather than a bare
 * "incorrect".
 */
export const verifyVaultPassword = async (
    password: string,
): Promise<boolean> => {
    let masterKey: Uint8Array
    try {
        masterKey = await unwrapMasterKeyThrottled(password)
    } catch (error) {
        if (error instanceof InvalidPasswordError) return false
        throw error
    }
    // Verification only — the key is not needed beyond proving it decrypts.
    masterKey.fill(0)
    return true
}

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

    const kek = await deriveKekForBlob(password, blob, saltBytes)
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

/**
 * Re-wraps a legacy PBKDF2 blob under Argon2id, now that a correct password
 * has produced the master key.
 *
 * Unlock is the only moment both halves are in hand, so migration rides along
 * with it rather than needing a separate prompt. Best-effort by design: a
 * storage failure here must not turn a successful unlock into a failed one —
 * the user keeps a working (if weaker) vault and the next unlock retries.
 */
const migrateBlobIfLegacy = async (
    password: string,
    masterKey: Uint8Array,
): Promise<void> => {
    try {
        const blob = await readWrappedMasterKey()
        if (blob.version === 2) return
        await writeWrappedMasterKey(password, masterKey)
    } catch {
        // Intentionally swallowed — see the doc comment.
    }
}

export const unlockVault = async (password: string): Promise<void> => {
    const masterKey = await unwrapMasterKeyThrottled(password)
    try {
        await putSessionMasterKey(masterKey)
        await armAutoLock()
        await migrateBlobIfLegacy(password, masterKey)
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
    // Throttled like every other password check — this is reachable from an
    // unlocked session, where the value at stake is the password itself
    // (reused elsewhere, or needed for persistence), not the master key.
    const masterKey = await unwrapMasterKeyThrottled(currentPassword)
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
