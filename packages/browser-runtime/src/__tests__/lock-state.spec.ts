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
import {
    createChromeFake,
    type ChromeFake,
} from '@perawallet/wallet-extension-platform-chrome/test-utils'
import {
    LOCK_STATE_SCOPE,
    createOffscreenLockState,
    installLockStateHost,
} from '../lock-state'

const CONTENT_SCRIPT_SENDER = {
    id: 'test-extension-id',
    url: 'https://dapp.example/',
}

describe('lock state channel', () => {
    let fake: ChromeFake
    let announce: (isUnlocked: boolean) => void
    let isUnlocked: ReturnType<typeof vi.fn<() => Promise<boolean>>>

    beforeEach(() => {
        fake = createChromeFake()
        isUnlocked = vi.fn(async () => true)
        installLockStateHost({
            chromeLike: fake.chrome,
            isUnlocked,
            onLockStateChanged: listener => {
                announce = listener
            },
        })
    })

    it('seeds the offscreen mirror from the worker without announcing it', async () => {
        const state = createOffscreenLockState(fake.chrome)
        const listener = vi.fn()
        state.subscribe(listener)

        await state.ready

        expect(state.isLocked()).toBe(false)
        expect(listener).not.toHaveBeenCalled()
    })

    it('counts as locked until the worker answers, and when it cannot read the state', async () => {
        isUnlocked.mockRejectedValue(new Error('session unavailable'))
        const state = createOffscreenLockState(fake.chrome)

        expect(state.isLocked()).toBe(true)
        await state.ready

        expect(state.isLocked()).toBe(true)
    })

    it('passes on the first lock heard after the worker could not say', async () => {
        isUnlocked.mockRejectedValue(new Error('session unavailable'))
        const state = createOffscreenLockState(fake.chrome)
        const listener = vi.fn()
        state.subscribe(listener)

        expect(await state.ready).toBeUndefined()
        announce(false)
        await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(true))

        expect(state.isLocked()).toBe(true)
    })

    it('resolves ready with the seeded state', async () => {
        const state = createOffscreenLockState(fake.chrome)

        expect(await state.ready).toBe(false)
    })

    it('passes each lock and unlock on to subscribers', async () => {
        const state = createOffscreenLockState(fake.chrome)
        await state.ready
        const listener = vi.fn()
        state.subscribe(listener)

        announce(false)
        await vi.waitFor(() => expect(state.isLocked()).toBe(true))
        announce(true)
        await vi.waitFor(() => expect(state.isLocked()).toBe(false))

        expect(listener.mock.calls).toEqual([[true], [false]])
    })

    it('ignores a lock state sent from a web page', async () => {
        const state = createOffscreenLockState(fake.chrome)
        await state.ready

        await fake.chrome.runtime
            .sendMessage(
                { scope: LOCK_STATE_SCOPE, kind: 'changed', isLocked: true },
                CONTENT_SCRIPT_SENDER,
            )
            .catch(() => undefined)

        expect(state.isLocked()).toBe(false)
    })

    it('answers no web page asking for the lock state', async () => {
        const answer = await fake.chrome.runtime
            .sendMessage(
                { scope: LOCK_STATE_SCOPE, kind: 'get' },
                CONTENT_SCRIPT_SENDER,
            )
            .catch(() => 'unanswered')

        expect(answer).toBe('unanswered')
    })
})
