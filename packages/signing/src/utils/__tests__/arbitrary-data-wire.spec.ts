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

import { describe, expect, it } from 'vitest'
import { MAX_DATA_SIGN_REQUESTS } from '../../constants'
import {
    LEGACY_DATA_MAX_ITEM_CHARS,
    LEGACY_DATA_MAX_REQUEST_CHARS,
    legacyArbitraryDataWireSchema,
} from '../arbitrary-data-wire'

const SIGNER = 'A'.repeat(58)
const item = (data: unknown, extra: Record<string, unknown> = {}) => ({
    data,
    signer: SIGNER,
    ...extra,
})
const parse = (items: unknown[]) =>
    legacyArbitraryDataWireSchema.safeParse(items).success

describe('legacyArbitraryDataWireSchema', () => {
    it('accepts a canonical base64 item', () => {
        expect(parse([item('ZGF0YQ==', { message: 'Sign this' })])).toBe(true)
    })

    it.each([
        ['an object', { nested: true }],
        ['an empty string', ''],
        ['a non-base64 string', '!!!!'],
        ['a truncated base64 string', 'ZGF0YQ='],
    ])('rejects data that is %s', (_, data) => {
        expect(parse([item(data)])).toBe(false)
    })

    it('rejects an item over the per-item cap', () => {
        expect(parse([item('A'.repeat(LEGACY_DATA_MAX_ITEM_CHARS + 4))])).toBe(
            false,
        )
    })

    it('rejects a message over the per-item cap', () => {
        const message = 'm'.repeat(LEGACY_DATA_MAX_ITEM_CHARS + 1)

        expect(parse([item('ZGF0YQ==', { message })])).toBe(false)
    })

    it('rejects a request whose items together exceed the request cap', () => {
        const full = item('A'.repeat(LEGACY_DATA_MAX_ITEM_CHARS))
        const count = LEGACY_DATA_MAX_REQUEST_CHARS / LEGACY_DATA_MAX_ITEM_CHARS

        expect(parse(Array.from({ length: count }, () => full))).toBe(true)
        expect(parse(Array.from({ length: count + 1 }, () => full))).toBe(false)
    })

    it('caps the batch at the signing pipeline maximum', () => {
        expect(
            parse(
                Array.from({ length: MAX_DATA_SIGN_REQUESTS + 1 }, () =>
                    item('ZGF0YQ=='),
                ),
            ),
        ).toBe(false)
    })
})
