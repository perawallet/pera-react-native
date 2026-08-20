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

// packages/backup/src/cloud/sync/__tests__/canonicalize.spec.ts
// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { canonicalJson, contentHash } from '../canonicalize'

describe('canonicalJson', () => {
    it('orders object keys deterministically regardless of insertion order', () => {
        const a = canonicalJson({ b: 1, a: 2, c: { y: 1, x: 2 } })
        const b = canonicalJson({ c: { x: 2, y: 1 }, a: 2, b: 1 })
        expect(a).toBe(b)
        expect(a).toBe('{"a":2,"b":1,"c":{"x":2,"y":1}}')
    })

    it('drops undefined values (matching JSON.stringify) but keeps null', () => {
        expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}')
    })
})

describe('contentHash', () => {
    it('is stable for equal input and differs for different input', () => {
        expect(contentHash('hello')).toBe(contentHash('hello'))
        expect(contentHash('hello')).not.toBe(contentHash('world'))
    })

    it('returns a 64-char lowercase hex string (sha256)', () => {
        expect(contentHash('x')).toMatch(/^[0-9a-f]{64}$/)
    })
})
