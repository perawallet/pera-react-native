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
// Ported from @algorandfoundation/react-native-keystore@1.0.0-canary.12
// storage/crypto.ts — Keychain replaced by the session vault, quick-crypto
// replaced by @noble/ciphers (sync, format-identical to node aes-256-gcm).

import { gcm } from '@noble/ciphers/aes.js'
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js'
import { base64 } from '@scure/base'
import { VaultLockedError } from '../errors'
import { getSessionMasterKey } from '../vault/session'
import type { AuthenticationOptions } from '../types'

const GCM_TAG_LENGTH = 16

/**
 * Returns the raw master key from chrome.storage.session. Unlike mobile
 * (which auto-generates in the OS Keychain), the web vault NEVER generates
 * here: creation happens in createVault() during onboarding, and every other
 * path requires an unlocked session. `options` (biometric prompt config) is
 * accepted for surface parity and ignored. Mirrors upstream canary.13's
 * read-only accessor name (`readMasterKey`, renamed from `getMasterKey`).
 */
export async function readMasterKey(
    _options?: AuthenticationOptions,
): Promise<Uint8Array> {
    const key = await getSessionMasterKey()
    if (!key) {
        throw new VaultLockedError(
            'Vault is locked. Unlock it before using the keystore.',
        )
    }
    return key
}

/**
 * Binds a ciphertext to the storage key it lives under, as GCM additional
 * authenticated data.
 *
 * Without it every entry is encrypted under the same master key with nothing
 * tying it to its location, so an attacker with write access to the profile
 * can swap the ciphertexts at `keystore:<idA>` and `keystore:<idB>` and both
 * still decrypt cleanly — the wallet then resolves the wrong signing key for
 * an address. AAD makes that swap fail authentication instead.
 */
const aadFor = (keyId: string): Uint8Array => utf8ToBytes(`keystore:${keyId}`)

type EncryptedPayload = {
    iv: string
    tag: string
    content: string
    /**
     * Format marker. Absent means a legacy entry written before AAD binding,
     * which must still decrypt (unbound) or existing wallets would be
     * unreadable — see decryptData.
     */
    v?: 2
}

/**
 * AES-256-GCM. Payload is JSON of { iv, tag, content, v } — 12-byte IV,
 * detached 16-byte tag, all base64. The detached-tag layout is byte-identical
 * to mobile's node-style crypto; `v` and the AAD binding are web-only
 * additions (mobile keeps its secrets in the OS keychain, where an attacker
 * who could swap two entries already has the keychain).
 */
export const encryptData = (
    key: Uint8Array,
    data: string,
    keyId: string,
): string => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    // noble appends the 16-byte tag to the ciphertext; mobile stores it
    // detached — split to preserve the format.
    const sealed = gcm(key, iv, aadFor(keyId)).encrypt(utf8ToBytes(data))
    const content = sealed.subarray(0, sealed.length - GCM_TAG_LENGTH)
    const tag = sealed.subarray(sealed.length - GCM_TAG_LENGTH)
    return JSON.stringify({
        iv: base64.encode(iv),
        tag: base64.encode(tag),
        content: base64.encode(content),
        v: 2,
    } satisfies EncryptedPayload)
}

/** True when the stored payload predates AAD binding. */
export const isLegacyPayload = (payloadStr: string): boolean => {
    try {
        return (JSON.parse(payloadStr) as EncryptedPayload).v !== 2
    } catch {
        return false
    }
}

export const decryptData = (
    key: Uint8Array,
    payloadStr: string,
    keyId: string,
): string => {
    const payload = JSON.parse(payloadStr) as EncryptedPayload
    const content = base64.decode(payload.content)
    const tag = base64.decode(payload.tag)
    const sealed = new Uint8Array(content.length + tag.length)
    sealed.set(content)
    sealed.set(tag, content.length)
    // Legacy entries were sealed with no AAD, so they must be opened with
    // none — passing it would fail authentication on every pre-existing key.
    // They're re-sealed bound on first read (see fetchSecret).
    const aad = payload.v === 2 ? aadFor(keyId) : undefined
    return bytesToUtf8(gcm(key, base64.decode(payload.iv), aad).decrypt(sealed))
}
