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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
    AppLifecycleService,
    AppLifecycleState,
} from '../app-lifecycle/models'

export type AppLifecycleHarness = {
    service: AppLifecycleService
    /** Drives the platform source the way the OS would. */
    emit: (state: 'active' | 'background') => void
}

/**
 * Shared behavioral contract for every AppLifecycleService driver. The two
 * states it drives are the only ones every platform can produce.
 */
export const runAppLifecycleContract = (
    name: string,
    createHarness: () => AppLifecycleHarness,
): void => {
    describe(`AppLifecycleService contract: ${name}`, () => {
        let harness: AppLifecycleHarness

        beforeEach(() => {
            harness = createHarness()
        })

        it('reports the state the platform last emitted', () => {
            harness.emit('background')
            expect(harness.service.getCurrentState()).toBe('background')

            harness.emit('active')
            expect(harness.service.getCurrentState()).toBe('active')
        })

        it('delivers each change to a listener in order', () => {
            const seen: AppLifecycleState[] = []
            harness.service.addChangeListener(state => seen.push(state))

            harness.emit('background')
            harness.emit('active')

            expect(seen).toEqual(['background', 'active'])
        })

        it('notifies listeners in subscription order', () => {
            const calls: string[] = []
            harness.service.addChangeListener(() => calls.push('first'))
            harness.service.addChangeListener(() => calls.push('second'))

            harness.emit('background')

            expect(calls).toEqual(['first', 'second'])
        })

        it('stops notifying only the listener that unsubscribed', () => {
            const removed = vi.fn()
            const kept = vi.fn()
            const unsubscribe = harness.service.addChangeListener(removed)
            harness.service.addChangeListener(kept)

            unsubscribe()
            harness.emit('background')

            expect(removed).not.toHaveBeenCalled()
            expect(kept).toHaveBeenCalledWith('background')
        })
    })
}
