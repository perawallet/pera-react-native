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

import { gcm } from '@noble/ciphers/aes'
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils'
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
 * AES-256-GCM, byte-identical payload format to mobile's node-style crypto:
 * JSON of { iv, tag, content } — 12-byte IV, detached 16-byte tag, all base64.
 */
export const encryptData = (key: Uint8Array, data: string): string => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    // noble appends the 16-byte tag to the ciphertext; mobile stores it
    // detached — split to preserve the format.
    const sealed = gcm(key, iv).encrypt(utf8ToBytes(data))
    const content = sealed.subarray(0, sealed.length - GCM_TAG_LENGTH)
    const tag = sealed.subarray(sealed.length - GCM_TAG_LENGTH)
    return JSON.stringify({
        iv: base64.encode(iv),
        tag: base64.encode(tag),
        content: base64.encode(content),
    })
}

export const decryptData = (key: Uint8Array, payloadStr: string): string => {
    const payload = JSON.parse(payloadStr) as {
        iv: string
        tag: string
        content: string
    }
    const content = base64.decode(payload.content)
    const tag = base64.decode(payload.tag)
    const sealed = new Uint8Array(content.length + tag.length)
    sealed.set(content)
    sealed.set(tag, content.length)
    return bytesToUtf8(gcm(key, base64.decode(payload.iv)).decrypt(sealed))
}
