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

import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@perawallet/wallet-core-shared'

/** Deterministic JSON: object keys sorted recursively. Mirrors JSON.stringify
 *  semantics for arrays/primitives and for dropping `undefined`. */
export const canonicalJson = (value: unknown): string => {
    const seen = new WeakSet<object>()
    const normalize = (v: unknown): unknown => {
        if (v === null || typeof v !== 'object') return v
        if (seen.has(v as object)) {
            throw new Error('canonicalJson: circular reference')
        }
        seen.add(v as object)
        if (Array.isArray(v)) return v.map(normalize)
        const out: Record<string, unknown> = {}
        for (const key of Object.keys(v as Record<string, unknown>).sort()) {
            const child = (v as Record<string, unknown>)[key]
            if (child !== undefined) out[key] = normalize(child)
        }
        return out
    }
    return JSON.stringify(normalize(value))
}

/** Lowercase-hex SHA-256 of a UTF-8 string. */
export const contentHash = (plaintext: string): string =>
    bytesToHex(sha256(new TextEncoder().encode(plaintext)))
