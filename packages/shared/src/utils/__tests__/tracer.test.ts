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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MockInstance } from 'vitest'
import { tracer } from '../tracer'
import { logger } from '../logging'

describe('tracer', () => {
    let infoSpy: MockInstance

    beforeEach(() => {
        infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
        // Module-level state persists across tests — start each one clean.
        tracer.reset()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    test('mark logs a single prefixed line containing the label', () => {
        tracer.mark('step-a')

        expect(infoSpy).toHaveBeenCalledTimes(1)
        expect(infoSpy.mock.calls[0][0]).toContain('[TRACE]')
        expect(infoSpy.mock.calls[0][0]).toContain('step-a')
    })

    test('mark serializes meta into the line', () => {
        tracer.mark('with-meta', { count: 3 })

        expect(infoSpy.mock.calls[0][0]).toContain('"count":3')
    })

    test('mark is one-shot per label — duplicates are ignored', () => {
        tracer.mark('dupe')
        tracer.mark('dupe')

        expect(infoSpy).toHaveBeenCalledTimes(1)
    })

    test('reset re-anchors the session and re-allows a label', () => {
        tracer.mark('again')
        tracer.reset()
        tracer.mark('again')

        expect(infoSpy).toHaveBeenCalledTimes(2)
    })

    describe('track', () => {
        test('returns the resolved value and marks the measured duration', async () => {
            const result = await tracer.track('fetch', async () => 42)

            expect(result).toBe(42)
            const line = infoSpy.mock.calls.find(c =>
                String(c[0]).includes('fetch'),
            )?.[0]
            expect(line).toContain('durationMs')
        })

        test('marks an :error variant and rethrows on rejection', async () => {
            const boom = new Error('boom')

            await expect(
                tracer.track('fails', async () => {
                    throw boom
                }),
            ).rejects.toBe(boom)

            const line = infoSpy.mock.calls.find(c =>
                String(c[0]).includes('fails:error'),
            )?.[0]
            expect(line).toContain('fails:error')
            expect(line).toContain('boom')
        })
    })

    test('dump prints an ordered timeline of the recorded marks', () => {
        tracer.mark('one')
        tracer.mark('two')
        infoSpy.mockClear()

        tracer.dump('test-run')

        expect(infoSpy).toHaveBeenCalledTimes(1)
        const table = String(infoSpy.mock.calls[0][0])
        expect(table).toContain('TIMELINE (test-run)')
        expect(table).toContain('one')
        expect(table).toContain('two')
    })

    describe('instrumentQueryCache', () => {
        test('marks a query when it settles, then unsubscribes after the window', () => {
            vi.useFakeTimers()
            const unsubscribe = vi.fn()
            let captured: ((event: unknown) => void) | undefined
            const cache = {
                subscribe: (cb: (event: unknown) => void) => {
                    captured = cb
                    return unsubscribe
                },
            }

            tracer.instrumentQueryCache(cache, 5000)
            expect(captured).toBeDefined()

            const query = {
                queryHash: 'h1',
                queryKey: ['accounts', 'balance'],
                state: { fetchStatus: 'fetching', status: 'pending' },
            }
            // Start fetching, then settle.
            captured!({ query })
            query.state.fetchStatus = 'idle'
            query.state.status = 'success'
            captured!({ query })

            const line = infoSpy.mock.calls.find(c =>
                String(c[0]).includes('query:accounts'),
            )?.[0]
            expect(line).toContain('query:accounts:first')
            expect(line).toContain('"status":"success"')

            expect(unsubscribe).not.toHaveBeenCalled()
            vi.advanceTimersByTime(5000)
            expect(unsubscribe).toHaveBeenCalledTimes(1)
        })

        test('ignores a settle event with no preceding fetch', () => {
            const cache = {
                subscribe: (cb: (event: unknown) => void) => {
                    cb({
                        query: {
                            queryHash: 'h2',
                            queryKey: ['assets'],
                            state: { fetchStatus: 'idle', status: 'success' },
                        },
                    })
                    return vi.fn()
                },
            }

            tracer.instrumentQueryCache(cache, 1000)

            expect(
                infoSpy.mock.calls.some(c => String(c[0]).includes('query:')),
            ).toBe(false)
        })
    })

    test('enabled is true by default', () => {
        expect(tracer.enabled).toBe(true)
    })

    test('is a no-op when disabled via the global flag', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const flagHolder = globalThis as { __PERA_TRACER__?: boolean }
        const original = flagHolder.__PERA_TRACER__
        flagHolder.__PERA_TRACER__ = false
        vi.resetModules()

        try {
            const { tracer: disabled } = await import('../tracer')
            disabled.mark('nope')
            disabled.dump()

            expect(disabled.enabled).toBe(false)
            // Disabled tracer short-circuits before any logging path.
            expect(consoleSpy).not.toHaveBeenCalled()
        } finally {
            flagHolder.__PERA_TRACER__ = original
            vi.resetModules()
        }
    })
})
