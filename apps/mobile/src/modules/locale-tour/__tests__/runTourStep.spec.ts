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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockLaunch, mockChangeLanguage, mockDismissAll, sheetStore } =
    vi.hoisted(() => {
        type SheetRequest = { id: string }
        type SheetStoreListener = (state: { requests: SheetRequest[] }) => void

        let requests: SheetRequest[] = []
        const listeners = new Set<SheetStoreListener>()

        return {
            mockLaunch: vi.fn(),
            mockChangeLanguage: vi.fn(() => Promise.resolve()),
            mockDismissAll: vi.fn(),
            sheetStore: {
                reset: () => {
                    requests = []
                    listeners.clear()
                },
                // Simulates the real store's request()/requestByType() push,
                // which is what the mount-wait is watching for.
                addRequest: (id: string) => {
                    requests = [...requests, { id }]
                    listeners.forEach(listener => listener({ requests }))
                },
                getRequests: () => requests,
                subscribe: (listener: SheetStoreListener) => {
                    listeners.add(listener)
                    return () => listeners.delete(listener)
                },
            },
        }
    })

vi.mock(
    '@modules/settings/screens/developer/gallery-catalog/launchGalleryEntry',
    () => ({ launchGalleryEntry: mockLaunch }),
)

vi.mock('i18next', () => ({
    default: { changeLanguage: mockChangeLanguage },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: {
        getState: () => ({
            requests: sheetStore.getRequests(),
            dismissAll: mockDismissAll,
        }),
        subscribe: sheetStore.subscribe,
    },
}))

import { recordOverflow } from '@components/core/PWText/overflowRegistry'

import { CAPTURE_HOLD_MS } from '../utils/runTour'
import {
    runTourStep,
    TOUR_SHOT_MARKER,
    TOUR_ERROR_MARKER,
    TOUR_OVERFLOW_MARKER,
    SETTLE_TIMEOUT_MS,
} from '../utils/runTourStep'
import { getTourSteps } from '../utils/steps'

describe('runTourStep', () => {
    let logged: string[]

    beforeEach(() => {
        vi.clearAllMocks()
        sheetStore.reset()
        logged = []
        vi.spyOn(console, 'log').mockImplementation(line => {
            logged.push(String(line))
        })
    })

    it('switches locale before launching, so the surface renders translated', async () => {
        const step = getTourSteps()[0]
        const order: string[] = []
        mockChangeLanguage.mockImplementation(() => {
            order.push('locale')
            return Promise.resolve()
        })
        mockLaunch.mockImplementation(() => {
            order.push('launch')
        })

        await runTourStep({ stepId: step.id, locale: 'en-XA' })

        expect(mockChangeLanguage).toHaveBeenCalledWith('en-XA')
        expect(order).toEqual(['locale', 'launch'])
    })

    it('dismisses any open sheet before launching the next surface', async () => {
        const step = getTourSteps()[0]

        await runTourStep({ stepId: step.id, locale: 'en' })

        expect(mockDismissAll).toHaveBeenCalled()
    })

    it('emits the shot marker with the step id once settled, and resolves the shot outcome', async () => {
        const step = getTourSteps()[0]

        const outcome = await runTourStep({ stepId: step.id, locale: 'en' })

        expect(
            logged.some(
                line =>
                    line.startsWith(TOUR_SHOT_MARKER) && line.includes(step.id),
            ),
        ).toBe(true)
        expect(outcome).toBe('shot')
    })

    it('emits an error marker and no shot marker for an unknown step, and resolves the unknown-step outcome', async () => {
        const outcome = await runTourStep({ stepId: 'scr-nope', locale: 'en' })

        expect(logged.some(line => line.startsWith(TOUR_ERROR_MARKER))).toBe(
            true,
        )
        expect(logged.some(line => line.startsWith(TOUR_SHOT_MARKER))).toBe(
            false,
        )
        expect(mockLaunch).not.toHaveBeenCalled()
        expect(outcome).toBe('unknown-step')
    })

    it('does not emit the shot marker until a sheet request lands in the store', async () => {
        const step = getTourSteps(['sheets'])[0]

        const runPromise = runTourStep({ stepId: step.id, locale: 'en' })

        // Let dismissAll -> changeLanguage -> launch run up to the point
        // where runTourStep is waiting on the store.
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(logged.some(line => line.startsWith(TOUR_SHOT_MARKER))).toBe(
            false,
        )

        sheetStore.addRequest('mock-sheet-request')

        await runPromise

        expect(
            logged.some(
                line =>
                    line.startsWith(TOUR_SHOT_MARKER) && line.includes(step.id),
            ),
        ).toBe(true)
    })

    it('emits ERR and no SHOT when the launch reports navigation-not-ready, and resolves that outcome for the caller', async () => {
        const step = getTourSteps()[0]
        mockLaunch.mockReturnValueOnce('navigation-not-ready')

        const outcome = await runTourStep({ stepId: step.id, locale: 'en' })

        expect(
            logged.some(
                line =>
                    line.startsWith(TOUR_ERROR_MARKER) &&
                    line.includes(step.id) &&
                    line.includes('navigation not ready'),
            ),
        ).toBe(true)
        expect(logged.some(line => line.startsWith(TOUR_SHOT_MARKER))).toBe(
            false,
        )
        // runTour uses this outcome (not the log line) to detect a
        // cascading navigation loss across consecutive steps.
        expect(outcome).toBe('navigation-not-ready')
    })

    it('emits ERR with the thrown message and resolves the launch-error outcome when launch throws', async () => {
        const step = getTourSteps()[0]
        mockLaunch.mockImplementationOnce(() => {
            throw new Error('catalog entry misconfigured')
        })

        const outcome = await runTourStep({ stepId: step.id, locale: 'en' })

        expect(
            logged.some(
                line =>
                    line.startsWith(TOUR_ERROR_MARKER) &&
                    line.includes('catalog entry misconfigured'),
            ),
        ).toBe(true)
        expect(outcome).toBe('launch-error')
    })

    it('includes a recorded overflow in the marker line for the step that produced it', async () => {
        const step = getTourSteps()[0]
        // Recorded from inside the launch, not before it — a record made
        // before this step's own launch is exactly what the pre-launch
        // drain (see runTourStep's drainOverflow() call) is meant to treat
        // as stale, so it must not be what this test relies on.
        mockLaunch.mockImplementationOnce(() => {
            recordOverflow({ key: 'foo', kind: 'truncated', text: 'Foo' })
        })

        await runTourStep({ stepId: step.id, locale: 'en' })

        const overflowLine = logged.find(line =>
            line.startsWith(TOUR_OVERFLOW_MARKER),
        )
        expect(overflowLine).toContain(step.id)
        expect(overflowLine).toContain(
            JSON.stringify([{ key: 'foo', kind: 'truncated', text: 'Foo' }]),
        )
    })

    it('discards a stale overflow recorded before this step launches, so it is not misattributed here', async () => {
        const step = getTourSteps()[0]
        recordOverflow({ key: 'stale', kind: 'truncated', text: 'Stale' })

        await runTourStep({ stepId: step.id, locale: 'en' })

        expect(logged.some(line => line.startsWith(TOUR_OVERFLOW_MARKER))).toBe(
            false,
        )
    })

    it('emits no overflow line when nothing was recorded', async () => {
        const step = getTourSteps()[0]

        await runTourStep({ stepId: step.id, locale: 'en' })

        expect(logged.some(line => line.startsWith(TOUR_OVERFLOW_MARKER))).toBe(
            false,
        )
    })

    // Exact strings, not the exported marker constants: apps/mobile/scripts/
    // locale-tour.mjs is a separate Node process that greps this literal
    // text out of Metro's log — it does not import TOUR_*_MARKER — so
    // renaming a constant's value, the `|` separator, or field order would
    // keep every other test in this file green while silently breaking the
    // driver's ability to parse the run.
    describe('marker wire format (consumed by apps/mobile/scripts/locale-tour.mjs)', () => {
        it('emits the literal SHOT line', async () => {
            const step = getTourSteps()[0]

            await runTourStep({ stepId: step.id, locale: 'en' })

            expect(logged).toContain(`LOCALE_TOUR_SHOT|${step.id}`)
        })

        it('emits the literal unknown-step ERR line', async () => {
            await runTourStep({ stepId: 'scr-nope', locale: 'en' })

            expect(logged).toContain('LOCALE_TOUR_ERR|scr-nope|unknown step')
        })

        it('emits the literal navigation-not-ready ERR line', async () => {
            const step = getTourSteps()[0]
            mockLaunch.mockReturnValueOnce('navigation-not-ready')

            await runTourStep({ stepId: step.id, locale: 'en' })

            expect(logged).toContain(
                `LOCALE_TOUR_ERR|${step.id}|navigation not ready`,
            )
        })

        it('emits the literal OVERFLOW line, JSON payload included', async () => {
            const step = getTourSteps()[0]
            mockLaunch.mockImplementationOnce(() => {
                recordOverflow({ key: 'foo', kind: 'truncated', text: 'Foo' })
            })

            await runTourStep({ stepId: step.id, locale: 'en' })

            expect(logged).toContain(
                `LOCALE_TOUR_OVERFLOW|${step.id}|` +
                    JSON.stringify([
                        { key: 'foo', kind: 'truncated', text: 'Foo' },
                    ]),
            )
        })
    })

    it('emits an error marker, not the shot marker, when a sheet never mounts', async () => {
        vi.useFakeTimers()
        const step = getTourSteps(['sheets'])[0]

        const runPromise = runTourStep({ stepId: step.id, locale: 'en' })
        await vi.advanceTimersByTimeAsync(SETTLE_TIMEOUT_MS)
        const outcome = await runPromise

        vi.useRealTimers()

        expect(
            logged.some(
                line =>
                    line.startsWith(TOUR_ERROR_MARKER) &&
                    line.includes(step.id),
            ),
        ).toBe(true)
        expect(logged.some(line => line.startsWith(TOUR_SHOT_MARKER))).toBe(
            false,
        )
        expect(outcome).toBe('sheet-not-mounted')
    })

    it('does not add the cross-step capture hold — that belongs to runTour, not this function, since the interactive single-step path has a human already watching', async () => {
        const step = getTourSteps()[0]

        const startedAt = Date.now()
        await runTourStep({ stepId: step.id, locale: 'en' })
        const elapsedMs = Date.now() - startedAt

        expect(elapsedMs).toBeLessThan(CAPTURE_HOLD_MS)
    })
})
