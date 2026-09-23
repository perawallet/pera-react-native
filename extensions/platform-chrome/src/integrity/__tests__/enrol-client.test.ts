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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake } from '../../test-utils/chrome'
import {
    holdIntegrityCheckHost,
    onHostedCheckEnded,
    onIntegrityEnrolmentNeeded,
    requestIntegrityEnrolment,
} from '../enrol-client'

describe('requestIntegrityEnrolment', () => {
    let fake: ReturnType<typeof createChromeFake>

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('sends the reason under the enrol scope and returns the decision', async () => {
        fake.messageListeners.add((message, _sender, sendResponse) => {
            expect(message).toEqual({
                scope: 'pera-integrity-enrol',
                kind: 'request',
                reason: 'page-open',
            })
            sendResponse({
                action: 'host',
                url: 'https://integrity-staging.perawallet.app/check',
                deadlineAt: 1,
            })
            return false
        })

        expect(await requestIntegrityEnrolment('page-open')).toEqual({
            action: 'host',
            url: 'https://integrity-staging.perawallet.app/check',
            deadlineAt: 1,
        })
    })

    it('answers none when the worker cannot be reached', async () => {
        vi.spyOn(fake.chrome.runtime, 'sendMessage').mockRejectedValue(
            new Error('no receiver'),
        )

        expect(await requestIntegrityEnrolment('page-open')).toEqual({
            action: 'none',
        })
    })
})

// A chrome-fake storage call settles within a few microtasks; draining one
// macrotask makes "did not fire" assertions reliable.
const settle = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0))

describe('onIntegrityEnrolmentNeeded', () => {
    let fake: ReturnType<typeof createChromeFake>

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('fires when the worker raises the flag', async () => {
        const listener = vi.fn()
        onIntegrityEnrolmentNeeded(listener)

        await fake.chrome.storage.session.set({ 'integrity:enrol-needed': 1 })

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('stays quiet when the worker clears the flag after enrolling', async () => {
        await fake.chrome.storage.session.set({ 'integrity:enrol-needed': 1 })
        const listener = vi.fn()
        onIntegrityEnrolmentNeeded(listener)

        await fake.chrome.storage.session.remove('integrity:enrol-needed')

        expect(listener).not.toHaveBeenCalled()
    })
})

describe('onHostedCheckEnded', () => {
    let fake: ReturnType<typeof createChromeFake>
    const TOKEN = 't'.repeat(22)
    const URL_FOR = (token: string) =>
        `https://integrity-staging.perawallet.app/check?v=1&kid=k&peraCheckToken=${token}`
    const attempt = (fields: Record<string, unknown>) => ({
        'integrity:enrol-attempt': {
            token: TOKEN,
            surface: 'frame',
            phase: 'checking',
            ...fields,
        },
    })

    beforeEach(async () => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        await fake.chrome.storage.session.set(attempt({}))
    })

    it('stays quiet while the hosted attempt is still running', async () => {
        const listener = vi.fn()
        onHostedCheckEnded(URL_FOR(TOKEN), listener)

        await fake.chrome.storage.session.set(attempt({ phase: 'enrolling' }))
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })

    it.each([
        ['finishes', attempt({ phase: 'done' })],
        [
            'moves to a tab under a new token',
            attempt({ token: 'n'.repeat(22), surface: 'tab' }),
        ],
    ])('fires when the hosted attempt %s', async (_label, items) => {
        const listener = vi.fn()
        onHostedCheckEnded(URL_FOR(TOKEN), listener)

        await fake.chrome.storage.session.set(items)

        await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
    })

    it('fires when the attempt record is removed', async () => {
        const listener = vi.fn()
        onHostedCheckEnded(URL_FOR(TOKEN), listener)

        await fake.chrome.storage.session.remove('integrity:enrol-attempt')

        await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
    })

    it('fires once on subscribe when the attempt was already over', async () => {
        await fake.chrome.storage.session.set(attempt({ phase: 'done' }))
        const listener = vi.fn()

        onHostedCheckEnded(URL_FOR(TOKEN), listener)
        await settle()

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('never fires after unsubscribing, even for a read already in flight', async () => {
        await fake.chrome.storage.session.set(attempt({ phase: 'done' }))
        const listener = vi.fn()

        onHostedCheckEnded(URL_FOR(TOKEN), listener)()
        await settle()

        expect(listener).not.toHaveBeenCalled()
    })
})

describe('holdIntegrityCheckHost', () => {
    const TOKEN = 't'.repeat(22)
    const URL_FOR = (token: string) =>
        `https://integrity-staging.perawallet.app/check?v=1&kid=k&peraCheckToken=${token}`

    type HeldPort = {
        name: string
        disconnect: ReturnType<typeof vi.fn>
        drop: () => void
    }
    const connectFake = () => {
        const ports: HeldPort[] = []
        const connect = vi.fn(({ name }: { name: string }) => {
            const listeners: Array<() => void> = []
            const port: HeldPort = {
                name,
                disconnect: vi.fn(),
                drop: () => listeners.forEach(fn => fn()),
            }
            ports.push(port)
            return {
                ...port,
                onDisconnect: {
                    addListener: (fn: () => void) => listeners.push(fn),
                },
            }
        })
        return {
            ports,
            chromeLike: { runtime: { connect } } as unknown as typeof chrome,
        }
    }

    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('holds a port named for the hosted token', () => {
        const { ports, chromeLike } = connectFake()

        holdIntegrityCheckHost(URL_FOR(TOKEN), chromeLike)

        expect(ports.map(port => port.name)).toEqual([
            `pera-integrity-host:${TOKEN}`,
        ])
    })

    it('reconnects after a worker restart drops the port', async () => {
        const { ports, chromeLike } = connectFake()
        holdIntegrityCheckHost(URL_FOR(TOKEN), chromeLike)

        ports[0]?.drop()
        await vi.advanceTimersByTimeAsync(1000)

        expect(ports).toHaveLength(2)
    })

    it('lets go for good once released', async () => {
        const { ports, chromeLike } = connectFake()
        const release = holdIntegrityCheckHost(URL_FOR(TOKEN), chromeLike)

        release()
        ports[0]?.drop()
        await vi.advanceTimersByTimeAsync(1000)

        expect(ports[0]?.disconnect).toHaveBeenCalledTimes(1)
        expect(ports).toHaveLength(1)
    })

    it('holds nothing for a URL without a valid token', () => {
        const { ports, chromeLike } = connectFake()

        holdIntegrityCheckHost(
            'https://integrity-staging.perawallet.app/check',
            chromeLike,
        )

        expect(ports).toHaveLength(0)
    })
})
