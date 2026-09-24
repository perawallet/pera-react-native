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
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { createLocalChromeFake, type LocalChromeFake } from './chrome-fake'
import { createSessionBackoff } from '../session-backoff'

const NOW = Date.parse('2026-09-23T12:00:00.000Z')
const MINUTE = 60 * 1000

describe('session backoff', () => {
    let fake: LocalChromeFake
    const backoff = createSessionBackoff({
        key: 'test:backoff',
        floorMs: 5 * MINUTE,
        capMs: 20 * MINUTE,
    })

    beforeAll(() => vi.useFakeTimers())
    afterAll(() => vi.useRealTimers())
    beforeEach(() => {
        vi.setSystemTime(NOW)
        fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('does not block before any failure', async () => {
        expect(await backoff.isBlocked()).toBe(false)
    })

    it('doubles from the floor and stops at the cap', async () => {
        const nextAttempt = async () =>
            (fake.session.get('test:backoff') as { nextAttemptAt: number })
                .nextAttemptAt - NOW

        await backoff.recordFailure()
        expect(await nextAttempt()).toBe(5 * MINUTE)
        await backoff.recordFailure()
        expect(await nextAttempt()).toBe(10 * MINUTE)
        await backoff.recordFailure()
        await backoff.recordFailure()
        expect(await nextAttempt()).toBe(20 * MINUTE)
    })

    it('blocks until the next attempt time, then clears', async () => {
        await backoff.recordFailure()
        expect(await backoff.isBlocked()).toBe(true)

        vi.setSystemTime(NOW + 5 * MINUTE)
        expect(await backoff.isBlocked()).toBe(false)

        await backoff.clear()
        expect(fake.session.has('test:backoff')).toBe(false)
    })
})
