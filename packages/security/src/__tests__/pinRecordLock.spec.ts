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
import { withPinRecordLock } from '../pinRecordLock'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe('withPinRecordLock', () => {
    test('runs each call only after the previous one settles', async () => {
        const events: string[] = []
        let releaseFirst: () => void = () => undefined

        const first = withPinRecordLock(async () => {
            events.push('first:start')
            await new Promise<void>(resolve => {
                releaseFirst = resolve
            })
            events.push('first:end')
        })
        const second = withPinRecordLock(async () => {
            events.push('second:start')
        })
        await tick()
        expect(events).toEqual(['first:start'])

        releaseFirst()
        await Promise.all([first, second])

        expect(events).toEqual(['first:start', 'first:end', 'second:start'])
    })

    test('a rejected call does not block the next one', async () => {
        const failed = withPinRecordLock(async () => {
            throw new Error('keystore unavailable')
        })
        const next = withPinRecordLock(async () => 'ran')

        await expect(failed).rejects.toThrow('keystore unavailable')
        await expect(next).resolves.toBe('ran')
    })
})
