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
import { withNamedLock } from '../named-lock'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('named lock', () => {
    it('runs holders of one name one at a time, in order', async () => {
        const order: string[] = []
        const first = withNamedLock('a', async () => {
            order.push('first-start')
            await tick()
            order.push('first-end')
        })
        const second = withNamedLock('a', async () => {
            order.push('second')
        })
        await Promise.all([first, second])

        expect(order).toEqual(['first-start', 'first-end', 'second'])
    })

    it('does not serialise different names against each other', async () => {
        const order: string[] = []
        const slow = withNamedLock('a', async () => {
            await tick()
            order.push('a')
        })
        const fast = withNamedLock('b', async () => {
            order.push('b')
        })
        await Promise.all([slow, fast])

        expect(order).toEqual(['b', 'a'])
    })

    it('returns the holder result and releases on a throw', async () => {
        await expect(
            withNamedLock('c', async () => {
                throw new Error('boom')
            }),
        ).rejects.toThrow('boom')
        expect(await withNamedLock('c', async () => 42)).toBe(42)
    })
})
