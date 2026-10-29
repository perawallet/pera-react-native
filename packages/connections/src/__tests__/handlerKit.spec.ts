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

import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import type { ConnectionHandlerContext } from '../handler'
import { connectionScope, createHandlerKit, pairingScope } from '../handlerKit'

const makeConnection = (overrides: Partial<Connection> = {}): Connection =>
    ({
        id: 'c1',
        kind: 'test-kind',
        name: 'dApp',
        peer: { name: 'dApp' },
        accounts: [],
        status: 'active',
        createdAt: 1,
        lastActiveAt: 1,
        ...overrides,
    }) as Connection

const makeStore = (
    records: Connection[] = [],
): ConnectionStoreAPI & {
    upsert: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
} => {
    const rows = new Map(records.map(record => [record.id, record]))
    return {
        get: vi.fn(async (id: string) => rows.get(id) ?? null),
        list: vi.fn(async () => [...rows.values()]),
        upsert: vi.fn(async (record: Connection) => {
            rows.set(record.id, record)
        }),
        remove: vi.fn(async (id: string) => {
            rows.delete(id)
        }),
    } as unknown as ConnectionStoreAPI & {
        upsert: ReturnType<typeof vi.fn>
        get: ReturnType<typeof vi.fn>
    }
}

const makeContext = (
    store: ConnectionStoreAPI = makeStore(),
): ConnectionHandlerContext & {
    onError: Mock<ConnectionHandlerContext['onError']>
} => ({
    store,
    onProposal: vi.fn(),
    onMessage: vi.fn(),
    onDisconnected: vi.fn(),
    onRequestExpired: vi.fn(),
    onError: vi.fn<ConnectionHandlerContext['onError']>(),
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createHandlerKit', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('context guard', () => {
        it('throws a default error naming the kind before attach', () => {
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })

            expect(() => kit.requireContext()).toThrow(
                'The test-kind handler was used before initialize()',
            )
            expect(() => kit.store()).toThrow(
                'The test-kind handler was used before initialize()',
            )
            expect(kit.currentContext()).toBeNull()
        })

        it('throws the injected error when one is given', () => {
            class ProtocolError extends Error {}
            const kit = createHandlerKit('test-kind', {
                logTag: '[test]',
                notInitializedError: () => new ProtocolError('not ready'),
            })

            expect(() => kit.requireContext()).toThrow(ProtocolError)
        })

        it('serves the attached context and store until detach', () => {
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            const context = makeContext()

            kit.attach(context)

            expect(kit.requireContext()).toBe(context)
            expect(kit.store()).toBe(context.store)
            expect(kit.currentContext()).toBe(context)

            kit.detach()
            expect(kit.currentContext()).toBeNull()
            expect(() => kit.store()).toThrow()
        })
    })

    describe('reportError', () => {
        it('logs and forwards the error with its scope', () => {
            const logError = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            const context = makeContext()
            kit.attach(context)
            const error = new Error('boom')

            kit.reportError(error, pairingScope('p1'))

            expect(logError).toHaveBeenCalledWith(error, { pairingId: 'p1' })
            expect(context.onError).toHaveBeenCalledWith(error, {
                pairingId: 'p1',
            })
        })

        it('wraps a non-Error value', () => {
            vi.spyOn(logger, 'error').mockImplementation(() => {})
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            const context = makeContext()
            kit.attach(context)

            kit.reportError('plain string', connectionScope('c1'))

            const [forwarded, scope] = context.onError.mock.calls[0]
            expect(forwarded).toBeInstanceOf(Error)
            expect(forwarded.message).toBe('plain string')
            expect(scope).toEqual({ connectionId: 'c1' })
        })

        it('only logs once detached', () => {
            const logError = vi
                .spyOn(logger, 'error')
                .mockImplementation(() => {})
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            const context = makeContext()
            kit.attach(context)
            kit.detach()

            kit.reportError(new Error('late'))

            expect(logError).toHaveBeenCalledOnce()
            expect(context.onError).not.toHaveBeenCalled()
        })
    })

    describe('recordActivity', () => {
        it('stamps lastActiveAt on the stored record', async () => {
            vi.spyOn(Date, 'now').mockReturnValue(5_000)
            const store = makeStore([makeConnection({ lastActiveAt: 1 })])
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            kit.attach(makeContext(store))

            kit.recordActivity('c1')
            await flush()

            expect(store.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'c1', lastActiveAt: 5_000 }),
            )
        })

        it('does not resurrect a record removed before the stamp', async () => {
            const store = makeStore()
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            kit.attach(makeContext(store))

            kit.recordActivity('gone')
            await flush()

            expect(store.upsert).not.toHaveBeenCalled()
        })

        it('logs a failure under the tag and log fields, never throwing', async () => {
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            const store = makeStore()
            const failure = new Error('db down')
            store.get.mockRejectedValue(failure)
            const kit = createHandlerKit('test-kind', {
                logTag: '[test]',
                activityLogFields: id => ({ clientId: id }),
            })
            kit.attach(makeContext(store))

            kit.recordActivity('c1')
            await flush()

            expect(warn).toHaveBeenCalledWith(
                '[test] failed to record connection activity',
                { clientId: 'c1', error: failure },
            )
        })

        it('defaults the log fields to the connection id', async () => {
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })

            // No context, so the store read itself throws.
            kit.recordActivity('c1')
            await flush()

            expect(warn).toHaveBeenCalledWith(
                '[test] failed to record connection activity',
                expect.objectContaining({ connectionId: 'c1' }),
            )
        })
    })

    describe('pendingOrigins', () => {
        const ORIGIN = { source: 'qr' } as const

        it('remembers, replaces and forgets an origin per pairing', () => {
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })

            kit.pendingOrigins.remember('p1', ORIGIN)
            kit.pendingOrigins.remember('p2', ORIGIN)
            kit.pendingOrigins.forget('p2')

            expect(kit.pendingOrigins.get('p1')).toEqual(ORIGIN)
            expect(kit.pendingOrigins.get('p2')).toBeUndefined()
        })

        it('clears an entry when remembered without an origin', () => {
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            kit.pendingOrigins.remember('p1', ORIGIN)

            kit.pendingOrigins.remember('p1')

            expect(kit.pendingOrigins.get('p1')).toBeUndefined()
        })

        it('drops every pending origin on detach', () => {
            const kit = createHandlerKit('test-kind', { logTag: '[test]' })
            kit.attach(makeContext())
            kit.pendingOrigins.remember('p1', ORIGIN)

            kit.detach()

            expect(kit.pendingOrigins.get('p1')).toBeUndefined()
        })
    })
})
