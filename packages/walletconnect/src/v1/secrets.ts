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

import {
    commitSecret,
    hasSecret,
    removeSecret,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'

const PREFIX = 'wc1-session-key:'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const sessionKeySecretRef = (clientId: string): string =>
    `${PREFIX}${clientId}`

/**
 * Store a v1 session key as a keystore `secret-key` entry.
 *
 * This fixes AT-REST exposure — the key is otherwise plaintext in MMKV. It
 * does not fix in-memory exposure: `session.key` is a hex string and
 * `new WalletConnect({ session })` retains it for the socket's lifetime, and
 * JS strings cannot be zeroed. The encoded byte buffer created here, unlike
 * the string, is zeroed once `commitSecret` has taken its own copy.
 *
 * Idempotent, so the migration importer can safely re-run after a crash.
 */
export const commitSessionKey = async (
    clientId: string,
    key: string,
): Promise<string> => {
    const id = sessionKeySecretRef(clientId)
    if (!hasSecret(id)) {
        const bytes = encoder.encode(key)
        try {
            await commitSecret({ id, bytes })
        } finally {
            zeroBytes(bytes)
        }
    }
    return id
}

/**
 * Run `handler` with the session key. `withSecret` zeroes the byte copy
 * afterwards; the decoded string is the caller's responsibility and cannot be
 * scrubbed. Resolves `null` when no secret is stored.
 */
export const withSessionKey = async <T>(
    clientId: string,
    handler: (key: string) => T | Promise<T>,
): Promise<T | null> =>
    withSecret(sessionKeySecretRef(clientId), bytes =>
        handler(decoder.decode(bytes)),
    )

export const removeSessionKey = async (clientId: string): Promise<void> => {
    await removeSecret(sessionKeySecretRef(clientId))
}
