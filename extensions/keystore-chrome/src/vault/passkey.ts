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
import { PasskeyUnlockError, VaultCorruptedError } from '../errors'
import { armAutoLock } from './autolock'
import { putSessionMasterKey } from './session'
import { unwrapMasterKeyWithPassword } from './vault'

// Storage keys — extension infrastructure, not kv:/keystore: prefixed.
const PRF_BLOB_KEY = 'vault:wrapped-master-key-prf'
const PRF_CRED_ID_KEY = 'vault:prf-credential-id'

// The fixed info string used in HKDF derivation — must match exactly on both
// enable and unlock paths.
const HKDF_INFO = new TextEncoder().encode('pera-vault-prf-kek-v1')

type WrappedMasterKeyPrfV1 = {
    version: 1
    kdf: 'HKDF-SHA256-PRF'
    /** HKDF salt (base64) — random per enablePasskeyUnlock call */
    hkdfSalt: string
    /** AES-GCM IV (base64) */
    iv: string
    /** AES-GCM ciphertext of the 32-byte master key (base64) */
    ciphertext: string
    /** PRF evaluation salt (base64) — passed as `prf.eval.first` in assertions */
    prfEvalSalt: string
}

const isValidPrfBlob = (x: unknown): x is WrappedMasterKeyPrfV1 =>
    typeof x === 'object' &&
    x !== null &&
    (x as WrappedMasterKeyPrfV1).version === 1 &&
    (x as WrappedMasterKeyPrfV1).kdf === 'HKDF-SHA256-PRF' &&
    typeof (x as WrappedMasterKeyPrfV1).hkdfSalt === 'string' &&
    typeof (x as WrappedMasterKeyPrfV1).iv === 'string' &&
    typeof (x as WrappedMasterKeyPrfV1).ciphertext === 'string' &&
    typeof (x as WrappedMasterKeyPrfV1).prfEvalSalt === 'string'

const readPrfBlob = async (): Promise<WrappedMasterKeyPrfV1> => {
    const stored = await chrome.storage.local.get(PRF_BLOB_KEY)
    const raw = stored[PRF_BLOB_KEY]
    if (typeof raw !== 'string') {
        throw new VaultCorruptedError()
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new VaultCorruptedError()
    }
    if (!isValidPrfBlob(parsed)) {
        throw new VaultCorruptedError()
    }
    return parsed
}

/**
 * Derive a 256-bit AES-GCM KEK from WebAuthn PRF output using HKDF-SHA-256.
 * The `hkdfSalt` is random per-enable and stored in the blob so unlock uses
 * the same salt.
 */
const deriveKekFromPrf = async (
    prfOutput: BufferSource,
    hkdfSalt: Uint8Array,
): Promise<CryptoKey> => {
    const material = await crypto.subtle.importKey(
        'raw',
        prfOutput,
        'HKDF',
        false,
        ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: hkdfSalt as BufferSource,
            info: HKDF_INFO as BufferSource,
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    )
}

/**
 * Returns true if the browser supports WebAuthn with the PRF extension.
 * Feature-detects conservatively: first checks the capability API (Chrome
 * 132+), otherwise falls back to checking PublicKeyCredential existence alone
 * and allows `enablePasskeyUnlock` to discover PRF support at runtime.
 */
export const isPasskeyUnlockSupported = async (): Promise<boolean> => {
    if (typeof PublicKeyCredential === 'undefined') return false
    if ('getClientCapabilities' in PublicKeyCredential) {
        try {
            const caps = await (
                PublicKeyCredential as {
                    getClientCapabilities: () => Promise<
                        Record<string, boolean>
                    >
                }
            ).getClientCapabilities()
            return caps?.prf === true
        } catch {
            // Capability API present but threw — treat as unsupported.
            return false
        }
    }
    // Pre-132 Chrome: PublicKeyCredential exists but no capability API. Allow
    // the caller to proceed; PRF support will be discovered during create.
    return true
}

export const isPasskeyUnlockEnabled = async (): Promise<boolean> => {
    const stored = await chrome.storage.local.get(PRF_BLOB_KEY)
    return typeof stored[PRF_BLOB_KEY] === 'string'
}

/**
 * Verifies `password`, creates a passkey with the PRF extension, and wraps
 * the existing master key with a KEK derived from the PRF output.
 *
 * This establishes a second KEK path for the same master key — password
 * unlock remains valid and is the recovery path.
 *
 * Chrome 116–131 support: `create()` requests `extensions: { prf: {} }` and
 * only checks `prf.enabled` (Chrome didn't return `prf.results` from create
 * until ~132). We then perform a follow-up `get()` assertion with the eval
 * salt to obtain the PRF output for the initial wrap.
 *
 * NOTE: If `prf.enabled` is false after create, we throw — but a credential
 * may still have been registered. There is no WebAuthn API to delete it; the
 * user must remove it from their authenticator manually. This is acceptable
 * because creation-with-PRF failing is an unusual path.
 */
export const enablePasskeyUnlock = async (password: string): Promise<void> => {
    // Verify the password first — throws InvalidPasswordError on wrong password.
    // This also gives us the master key bytes to wrap.
    const masterKey = await unwrapMasterKeyWithPassword(password)
    let prfOutput: ArrayBuffer | null = null
    try {
        // Random PRF eval salt persisted with the blob so assertions use the same input.
        const prfEvalSalt = crypto.getRandomValues(new Uint8Array(32))

        // Read any already-stored credential id so we can exclude it and avoid
        // accumulating duplicate credentials on repeated enable calls.
        const storedIdEntry = await chrome.storage.local.get(PRF_CRED_ID_KEY)
        const storedIdEncoded = storedIdEntry[PRF_CRED_ID_KEY]
        const excludeCredentials: PublicKeyCredentialDescriptor[] =
            typeof storedIdEncoded === 'string'
                ? [
                      {
                          type: 'public-key',
                          id: base64.decode(storedIdEncoded)
                              .buffer as ArrayBuffer,
                      },
                  ]
                : []

        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: { name: 'Pera Wallet' },
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: 'pera-vault',
                    displayName: 'Pera Vault',
                },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                authenticatorSelection: {
                    residentKey: 'required',
                    userVerification: 'required',
                },
                excludeCredentials,
                extensions: {
                    prf: {},
                } as AuthenticationExtensionsClientInputs,
            },
        })

        const pkCred = credential as PublicKeyCredential | null
        const prfEnabled =
            pkCred?.getClientExtensionResults()?.prf?.enabled ?? false

        // prf.results.first from create is only returned on Chrome 132+.
        // For Chrome 116–131, prf.enabled is true but results is absent —
        // perform a follow-up assertion to obtain the PRF output.
        prfOutput =
            (pkCred?.getClientExtensionResults()?.prf?.results?.first as
                | ArrayBuffer
                | undefined) ?? null

        if (!prfEnabled && prfOutput === null) {
            throw new Error(
                'PRF extension not supported or not returned by the authenticator.',
            )
        }

        if (prfOutput === null) {
            // Chrome 116–131 path: prf.enabled but no results from create.
            // Perform a follow-up assertion to obtain the PRF output.
            const credRawIdBytes = new Uint8Array(
                (pkCred as PublicKeyCredential & { rawId: ArrayBuffer }).rawId,
            )
            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    allowCredentials: [
                        {
                            type: 'public-key',
                            id: credRawIdBytes.buffer as ArrayBuffer,
                        },
                    ],
                    userVerification: 'required',
                    extensions: {
                        prf: {
                            eval: {
                                first: prfEvalSalt.buffer as ArrayBuffer,
                            },
                        },
                    } as AuthenticationExtensionsClientInputs,
                },
            })
            prfOutput =
                ((
                    assertion as PublicKeyCredential | null
                )?.getClientExtensionResults()?.prf?.results?.first as
                    | ArrayBuffer
                    | undefined) ?? null

            if (!prfOutput) {
                throw new Error(
                    'PRF extension not supported or not returned by the authenticator.',
                )
            }
        }

        // Derive a KEK from the PRF output and wrap the master key.
        const hkdfSalt = crypto.getRandomValues(new Uint8Array(16))
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const kek = await deriveKekFromPrf(prfOutput, hkdfSalt)

        const ciphertext = new Uint8Array(
            await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv as BufferSource },
                kek,
                masterKey as BufferSource,
            ),
        )

        const blob: WrappedMasterKeyPrfV1 = {
            version: 1,
            kdf: 'HKDF-SHA256-PRF',
            hkdfSalt: base64.encode(hkdfSalt),
            iv: base64.encode(iv),
            ciphertext: base64.encode(ciphertext),
            prfEvalSalt: base64.encode(prfEvalSalt),
        }

        // Fix: store rawId bytes (base64-encoded) not the base64url string id —
        // allowCredentials descriptors require the raw binary credential id.
        const credRawId = new Uint8Array(
            (pkCred as PublicKeyCredential & { rawId: ArrayBuffer }).rawId,
        )

        await chrome.storage.local.set({
            [PRF_BLOB_KEY]: JSON.stringify(blob),
            [PRF_CRED_ID_KEY]: base64.encode(credRawId),
        })
    } finally {
        masterKey.fill(0)
        // Zero PRF output bytes after KEK derivation.
        if (prfOutput !== null) {
            new Uint8Array(prfOutput).fill(0)
        }
    }
}

/**
 * Uses the stored passkey to assert, derives the KEK from the PRF output,
 * unwraps the master key, and puts it into the session (same as
 * `unlockVault`).
 */
export const unlockWithPasskey = async (): Promise<void> => {
    const blob = await readPrfBlob()

    let prfEvalSaltBytes: Uint8Array
    let hkdfSaltBytes: Uint8Array
    let ivBytes: Uint8Array
    let ciphertextBytes: Uint8Array
    try {
        prfEvalSaltBytes = base64.decode(blob.prfEvalSalt)
        hkdfSaltBytes = base64.decode(blob.hkdfSalt)
        ivBytes = base64.decode(blob.iv)
        ciphertextBytes = base64.decode(blob.ciphertext)
    } catch {
        throw new VaultCorruptedError()
    }

    const credIdStored = await chrome.storage.local.get(PRF_CRED_ID_KEY)
    const credentialIdEncoded = credIdStored[PRF_CRED_ID_KEY]

    // Fix: decode stored base64 → raw bytes for the allowCredentials descriptor.
    // Previously this used TextEncoder which produced ASCII bytes of the string,
    // matching no real credential and causing NotAllowedError on every attempt.
    const allowCredentials: PublicKeyCredentialDescriptor[] =
        typeof credentialIdEncoded === 'string'
            ? [
                  {
                      type: 'public-key',
                      id: base64.decode(credentialIdEncoded)
                          .buffer as ArrayBuffer,
                  },
              ]
            : []

    let prfOutput: ArrayBuffer | null = null
    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials,
                userVerification: 'required',
                extensions: {
                    prf: {
                        eval: {
                            first: prfEvalSaltBytes.buffer as ArrayBuffer,
                        },
                    },
                } as AuthenticationExtensionsClientInputs,
            },
        })

        prfOutput =
            ((
                assertion as PublicKeyCredential | null
            )?.getClientExtensionResults()?.prf?.results?.first as
                | ArrayBuffer
                | undefined) ?? null

        if (!prfOutput) {
            throw new Error(
                'PRF extension not supported or not returned by the authenticator.',
            )
        }

        const kek = await deriveKekFromPrf(prfOutput, hkdfSaltBytes)

        let masterKey: Uint8Array
        try {
            masterKey = new Uint8Array(
                await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: ivBytes as BufferSource },
                    kek,
                    ciphertextBytes as BufferSource,
                ),
            )
        } catch {
            // AES-GCM authentication tag failure — wrong PRF output (tampered or wrong key).
            throw new PasskeyUnlockError()
        }

        try {
            await putSessionMasterKey(masterKey)
            await armAutoLock()
        } finally {
            masterKey.fill(0)
        }
    } finally {
        // Zero PRF output bytes after KEK derivation.
        if (prfOutput !== null) {
            new Uint8Array(prfOutput).fill(0)
        }
    }
}

export const disablePasskeyUnlock = async (): Promise<void> => {
    await chrome.storage.local.remove([PRF_BLOB_KEY, PRF_CRED_ID_KEY])
}
