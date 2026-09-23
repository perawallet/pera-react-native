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

import { describe, test, expect } from 'vitest'
import {
    createItemKeyHasher,
    hashItemAddress,
    withItemKeyHasher,
    type ItemKeyHasher,
} from '../itemKeyHash'

const KEY = new Uint8Array(32).fill(1)
const OTHER_KEY = new Uint8Array(32).fill(2)
const ZERO_KEY = new Uint8Array(32)
const ADDRESS = 'AAAA'

describe('hashItemAddress', () => {
    test('produces 64 lowercase hex characters', () => {
        const hash = hashItemAddress(ADDRESS, KEY)

        expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    test('is stable for the same address and key', () => {
        expect(hashItemAddress(ADDRESS, KEY)).toBe(
            hashItemAddress(ADDRESS, KEY),
        )
    })

    test('separates addresses', () => {
        expect(hashItemAddress(ADDRESS, KEY)).not.toBe(
            hashItemAddress('BBBB', KEY),
        )
    })

    // Two wallets must never collide, and one wallet must never fork: the key
    // is the only thing that separates them.
    test('separates keys', () => {
        expect(hashItemAddress(ADDRESS, KEY)).not.toBe(
            hashItemAddress(ADDRESS, OTHER_KEY),
        )
    })
})

describe('createItemKeyHasher', () => {
    test('matches hashItemAddress for the key it closes over', () => {
        const hash = createItemKeyHasher(KEY)

        expect(hash(ADDRESS)).toBe(hashItemAddress(ADDRESS, KEY))
    })

    // The keystore zeroes the buffer it lends when its scope ends. A hasher
    // reading through to that buffer would keep working right up to the moment
    // it silently started keying every item off 32 zero bytes.
    test('is unaffected by the source buffer being zeroed', () => {
        const source = new Uint8Array(KEY)
        const hash = createItemKeyHasher(source)

        source.fill(0)

        expect(hash(ADDRESS)).toBe(hashItemAddress(ADDRESS, KEY))
    })

    test('zeroes its own copy on dispose', () => {
        const hash = createItemKeyHasher(KEY)

        hash.dispose()

        expect(hash(ADDRESS)).toBe(hashItemAddress(ADDRESS, ZERO_KEY))
    })
})

describe('withItemKeyHasher', () => {
    test('hashes under the given key inside the scope', async () => {
        const hash = await withItemKeyHasher(KEY, async h => h(ADDRESS))

        expect(hash).toBe(hashItemAddress(ADDRESS, KEY))
    })

    test('zeroes the copy once the scope returns', async () => {
        const escaped: ItemKeyHasher[] = []

        await withItemKeyHasher(KEY, async hash => {
            escaped.push(hash)
        })

        expect(escaped[0](ADDRESS)).toBe(hashItemAddress(ADDRESS, ZERO_KEY))
    })

    test('zeroes the copy when the scope throws', async () => {
        const escaped: ItemKeyHasher[] = []

        await expect(
            withItemKeyHasher(KEY, async hash => {
                escaped.push(hash)
                throw new Error('sync failed')
            }),
        ).rejects.toThrow('sync failed')

        expect(escaped[0](ADDRESS)).toBe(hashItemAddress(ADDRESS, ZERO_KEY))
    })
})
