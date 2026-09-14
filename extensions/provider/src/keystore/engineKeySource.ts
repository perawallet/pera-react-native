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

/**
 * Supplies the raw 32-byte vault master key, or throws when the vault is
 * locked. Registered by the web shell rather than imported: this package
 * cannot depend on the vault (`keystore-chrome → passkeys → provider` would
 * close a cycle), so the dependency runs the other way. Platform-neutral file
 * on purpose — a `.web.ts`-only export does not typecheck through the
 * package index, which `tsc` resolves against the non-platform files.
 * `resolveEngineKey` zeroes the returned array after import, so a source
 * must return a fresh copy on every call.
 */
export type EngineKeySource = () => Promise<Uint8Array>

let source: EngineKeySource | null = null

export const setEngineKeySource = (next: EngineKeySource): void => {
    source = next
}

/**
 * Resolved by the web driver on every seal and open — never cached, so a
 * lock in any context stops the next operation everywhere.
 */
export const resolveEngineKey = async (): Promise<CryptoKey> => {
    if (!source) {
        // A plain Error, not a lock: nothing a password can fix.
        throw new Error(
            'No engine key source registered; call setEngineKeySource() before the first keystore operation.',
        )
    }
    const bytes = await source()
    try {
        if (bytes.length !== 32) {
            throw new Error(
                `Engine key source returned ${bytes.length} bytes; expected 32 bytes`,
            )
        }
        return await globalThis.crypto.subtle.importKey(
            'raw',
            bytes as BufferSource,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt'],
        )
    } finally {
        bytes.fill(0)
    }
}
