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

// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { algo25SecretKeyToIndices, algo25SeedToIndices } from '../algo25-utils'

describe('algo25SecretKeyToIndices', () => {
    it('truncates a 64-byte keypair to the 32-byte seed before encoding', () => {
        const secretKey = new Uint8Array(64).fill(7)
        const seed = new Uint8Array(32).fill(7)

        expect(Array.from(algo25SecretKeyToIndices(secretKey))).toEqual(
            Array.from(algo25SeedToIndices(seed)),
        )
    })

    it('leaves the caller-owned secret key untouched', () => {
        const secretKey = new Uint8Array(64).fill(0xff)

        algo25SecretKeyToIndices(secretKey)

        expect(Array.from(secretKey)).toEqual(Array(64).fill(0xff))
    })

    it('rejects a buffer shorter than a 32-byte seed', () => {
        expect(() =>
            algo25SecretKeyToIndices(new Uint8Array(16).fill(3)),
        ).toThrow(RangeError)
    })
})
