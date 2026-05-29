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

import { describe, it, expect } from 'vitest'
import {
    readLiquidAuthSessionCookieWith,
    type CookieReader,
} from '../sessionCookie'

const reader = (cookies: Record<string, { value: string }>): CookieReader => ({
    get: async () => cookies,
})

describe('readLiquidAuthSessionCookie', () => {
    it('formats connect.sid as a header value', async () => {
        const result = await readLiquidAuthSessionCookieWith(
            reader({ 'connect.sid': { value: 's:abc.def' } }),
            'https://liquid.example.com',
        )
        expect(result).toBe('connect.sid=s:abc.def')
    })

    it('prefers connect.sid even when other cookies are present', async () => {
        const result = await readLiquidAuthSessionCookieWith(
            reader({
                other: { value: 'x' },
                'connect.sid': { value: 'sid' },
            }),
            'https://liquid.example.com',
        )
        expect(result).toBe('connect.sid=sid')
    })

    it('falls back to the only cookie when connect.sid is absent', async () => {
        const result = await readLiquidAuthSessionCookieWith(
            reader({ 'session.sid': { value: 'xyz' } }),
            'https://liquid.example.com',
        )
        expect(result).toBe('session.sid=xyz')
    })

    it('returns undefined when there are no cookies', async () => {
        const result = await readLiquidAuthSessionCookieWith(
            reader({}),
            'https://liquid.example.com',
        )
        expect(result).toBeUndefined()
    })

    it('returns undefined when multiple cookies but no connect.sid', async () => {
        const result = await readLiquidAuthSessionCookieWith(
            reader({ a: { value: '1' }, b: { value: '2' } }),
            'https://liquid.example.com',
        )
        expect(result).toBeUndefined()
    })

    it('returns undefined and does not throw when the reader fails', async () => {
        const failing: CookieReader = {
            get: async () => {
                throw new Error('jar unavailable')
            },
        }
        const result = await readLiquidAuthSessionCookieWith(
            failing,
            'https://liquid.example.com',
        )
        expect(result).toBeUndefined()
    })
})
