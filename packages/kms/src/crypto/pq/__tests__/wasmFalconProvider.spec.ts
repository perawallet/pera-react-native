// @vitest-environment node
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

import { describe, expect, test } from 'vitest'
import { FALCON_DET1024_SIG_COMPRESSED_MAXSIZE } from 'falcon-1024'
import { createWasmFalconProvider } from '../wasmFalconProvider'

describe('wasmFalconProvider', () => {
    const provider = createWasmFalconProvider()
    const seed = new Uint8Array(32).fill(9)

    test('derives a deterministic 1793-byte public key from a seed', () => {
        const a = provider.generateKeypairFromSeed(seed)
        const b = provider.generateKeypairFromSeed(seed)
        expect(a.publicKey.length).toBe(1793)
        expect(Buffer.compare(a.publicKey, b.publicKey)).toBe(0)
    })

    test('signs and produces a Falcon-sized signature', () => {
        const { secretKey } = provider.generateKeypairFromSeed(seed)
        const sig = provider.sign(secretKey, new Uint8Array([1, 2, 3]))
        expect(sig.length).toBeGreaterThan(0)
        expect(sig.length).toBeLessThanOrEqual(
            FALCON_DET1024_SIG_COMPRESSED_MAXSIZE,
        )
    })
})
