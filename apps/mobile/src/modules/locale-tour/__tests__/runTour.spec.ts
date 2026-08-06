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

const { mockRunTourStep, mockGetTourSteps } = vi.hoisted(() => ({
    mockRunTourStep: vi.fn(),
    mockGetTourSteps: vi.fn(),
}))

vi.mock('../utils/runTourStep', () => ({
    runTourStep: mockRunTourStep,
    TOUR_ERROR_MARKER: 'LOCALE_TOUR_ERR',
}))

vi.mock('../utils/steps', () => ({
    getTourSteps: mockGetTourSteps,
}))

import {
    runTour,
    TOUR_BEGIN_MARKER,
    TOUR_DONE_MARKER,
    CAPTURE_HOLD_MS,
    NAVIGATION_LOST_REASON,
} from '../utils/runTour'

import type { TourStep } from '../types'

const stubStep = (id: string): TourStep =>
    ({
        id,
        label: id,
        category: 'screens',
        entry: { id, label: id, launch: { kind: 'preview' } },
    }) as TourStep

describe('runTour', () => {
    let logged: string[]

    beforeEach(() => {
        vi.clearAllMocks()
        logged = []
        vi.spyOn(console, 'log').mockImplementation(line => {
            logged.push(String(line))
        })
        mockRunTourStep.mockImplementation(
            async ({ stepId }: { stepId: string; locale: string }) => {
                console.log(`LOCALE_TOUR_SHOT|${stepId}`)
            },
        )
    })

    it('emits BEGIN with the step count and locale, one SHOT per step in order, then DONE', async () => {
        const steps = [stubStep('scr-a'), stubStep('scr-b'), stubStep('scr-c')]
        mockGetTourSteps.mockReturnValue(steps)

        await runTour({ locale: 'en-XA' })

        expect(logged).toEqual([
            `${TOUR_BEGIN_MARKER}|3|en-XA`,
            'LOCALE_TOUR_SHOT|scr-a',
            'LOCALE_TOUR_SHOT|scr-b',
            'LOCALE_TOUR_SHOT|scr-c',
            TOUR_DONE_MARKER,
        ])
    })

    it('reuses runTourStep for every step rather than duplicating its logic', async () => {
        const steps = [stubStep('scr-a'), stubStep('scr-b')]
        mockGetTourSteps.mockReturnValue(steps)

        await runTour({ locale: 'en' })

        expect(mockRunTourStep).toHaveBeenNthCalledWith(1, {
            stepId: 'scr-a',
            locale: 'en',
        })
        expect(mockRunTourStep).toHaveBeenNthCalledWith(2, {
            stepId: 'scr-b',
            locale: 'en',
        })
    })

    it('forwards categories to getTourSteps, and omits the argument when none are given', async () => {
        mockGetTourSteps.mockReturnValue([])

        await runTour({ locale: 'en' })
        expect(mockGetTourSteps).toHaveBeenCalledWith(undefined)

        await runTour({ locale: 'en', categories: ['sheets'] })
        expect(mockGetTourSteps).toHaveBeenCalledWith(['sheets'])
    })

    it('does not abort the run when a step rejects — later steps still emit markers', async () => {
        const steps = [stubStep('scr-a'), stubStep('scr-b'), stubStep('scr-c')]
        mockGetTourSteps.mockReturnValue(steps)
        mockRunTourStep.mockImplementation(
            async ({ stepId }: { stepId: string; locale: string }) => {
                if (stepId === 'scr-b') {
                    throw new Error('boom')
                }
                console.log(`LOCALE_TOUR_SHOT|${stepId}`)
            },
        )

        await runTour({ locale: 'en' })

        expect(logged.some(line => line.includes('scr-a'))).toBe(true)
        expect(
            logged.some(
                line =>
                    line.startsWith('LOCALE_TOUR_ERR') &&
                    line.includes('scr-b'),
            ),
        ).toBe(true)
        expect(logged.some(line => line.includes('scr-c'))).toBe(true)
        expect(logged[logged.length - 1]).toBe(TOUR_DONE_MARKER)
    })

    it('does not abort the run when a step errors normally (resolves without throwing)', async () => {
        const steps = [stubStep('scr-a'), stubStep('scr-b')]
        mockGetTourSteps.mockReturnValue(steps)
        mockRunTourStep.mockImplementation(
            async ({ stepId }: { stepId: string; locale: string }) => {
                if (stepId === 'scr-a') {
                    console.log(`LOCALE_TOUR_ERR|${stepId}|unknown step`)
                    return
                }
                console.log(`LOCALE_TOUR_SHOT|${stepId}`)
            },
        )

        await runTour({ locale: 'en' })

        expect(logged).toEqual([
            `${TOUR_BEGIN_MARKER}|2|en`,
            'LOCALE_TOUR_ERR|scr-a|unknown step',
            'LOCALE_TOUR_SHOT|scr-b',
            TOUR_DONE_MARKER,
        ])
    })

    it('stops the run after 3 consecutive navigation-not-ready outcomes, emitting one distinguishable marker instead of grinding through the remainder', async () => {
        const steps = [
            stubStep('scr-a'),
            stubStep('scr-b'),
            stubStep('scr-c'),
            stubStep('scr-d'),
            stubStep('scr-e'),
        ]
        mockGetTourSteps.mockReturnValue(steps)
        mockRunTourStep.mockImplementation(
            async ({ stepId }: { stepId: string; locale: string }) => {
                if (stepId === 'scr-a') {
                    console.log(`LOCALE_TOUR_SHOT|${stepId}`)
                    return 'shot'
                }
                console.log(`LOCALE_TOUR_ERR|${stepId}|navigation not ready`)
                return 'navigation-not-ready'
            },
        )

        await runTour({ locale: 'en' })

        // scr-a (shot), scr-b/c/d (the 3 consecutive navigation-not-ready
        // that trip the threshold) — scr-e is never reached.
        expect(mockRunTourStep).toHaveBeenCalledTimes(4)
        expect(mockRunTourStep).not.toHaveBeenCalledWith(
            expect.objectContaining({ stepId: 'scr-e' }),
        )
        expect(
            logged.filter(line => line.includes(NAVIGATION_LOST_REASON)),
        ).toHaveLength(1)
        expect(
            logged.find(line => line.includes(NAVIGATION_LOST_REASON)),
        ).toContain('scr-d')
        expect(logged[logged.length - 1]).toBe(TOUR_DONE_MARKER)
    })

    it('does not stop the run when navigation-not-ready outcomes are not consecutive', async () => {
        const steps = [
            stubStep('scr-a'),
            stubStep('scr-b'),
            stubStep('scr-c'),
            stubStep('scr-d'),
            stubStep('scr-e'),
        ]
        mockGetTourSteps.mockReturnValue(steps)
        mockRunTourStep.mockImplementation(
            async ({ stepId }: { stepId: string; locale: string }) => {
                if (stepId === 'scr-c') {
                    console.log(`LOCALE_TOUR_SHOT|${stepId}`)
                    return 'shot'
                }
                console.log(`LOCALE_TOUR_ERR|${stepId}|navigation not ready`)
                return 'navigation-not-ready'
            },
        )

        await runTour({ locale: 'en' })

        expect(mockRunTourStep).toHaveBeenCalledTimes(5)
        expect(logged.some(line => line.includes(NAVIGATION_LOST_REASON))).toBe(
            false,
        )
        expect(logged[logged.length - 1]).toBe(TOUR_DONE_MARKER)
    })

    it('waits CAPTURE_HOLD_MS before starting the next step, so the driver has time to screenshot before the app moves on', async () => {
        vi.useFakeTimers()
        const steps = [stubStep('scr-a'), stubStep('scr-b')]
        mockGetTourSteps.mockReturnValue(steps)

        const runPromise = runTour({ locale: 'en' })

        await vi.advanceTimersByTimeAsync(0)
        expect(mockRunTourStep).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(CAPTURE_HOLD_MS - 1)
        expect(mockRunTourStep).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(1)
        expect(mockRunTourStep).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(CAPTURE_HOLD_MS)
        await runPromise

        vi.useRealTimers()
    })

    // Exact strings, not the exported marker constants: apps/mobile/scripts/
    // locale-tour.mjs is a separate Node process that greps this literal
    // text out of Metro's log — it does not import TOUR_*_MARKER — so
    // renaming a constant's value, the `|` separator, or field order would
    // keep every other test in this file green while silently breaking the
    // driver's ability to parse the run.
    describe('marker wire format (consumed by apps/mobile/scripts/locale-tour.mjs)', () => {
        it('emits the literal BEGIN line', async () => {
            mockGetTourSteps.mockReturnValue([stubStep('scr-a')])

            await runTour({ locale: 'en-XA' })

            expect(logged[0]).toBe('LOCALE_TOUR_BEGIN|1|en-XA')
        })

        it('emits the literal DONE line', async () => {
            mockGetTourSteps.mockReturnValue([])

            await runTour({ locale: 'en' })

            expect(logged[logged.length - 1]).toBe('LOCALE_TOUR_DONE')
        })

        it('emits the literal navigation-lost line, which the driver recognizes to report one cascade event instead of a list of ids', async () => {
            mockGetTourSteps.mockReturnValue([
                stubStep('scr-a'),
                stubStep('scr-b'),
                stubStep('scr-c'),
            ])
            mockRunTourStep.mockImplementation(
                async () => 'navigation-not-ready' as const,
            )

            await runTour({ locale: 'en' })

            expect(logged).toContain(
                'LOCALE_TOUR_ERR|scr-c|navigation lost — remaining steps unreliable',
            )
        })
    })

    it('emits the SHOT marker for a finished step before the hold that follows it, not after', async () => {
        vi.useFakeTimers()
        const steps = [stubStep('scr-a'), stubStep('scr-b')]
        mockGetTourSteps.mockReturnValue(steps)

        const runPromise = runTour({ locale: 'en' })

        // Flush the microtask that runs the mocked runTourStep, but do not
        // advance into the hold yet — the marker must already be logged.
        await vi.advanceTimersByTimeAsync(0)
        expect(logged).toContain('LOCALE_TOUR_SHOT|scr-a')
        expect(mockRunTourStep).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(CAPTURE_HOLD_MS)
        await vi.advanceTimersByTimeAsync(CAPTURE_HOLD_MS)
        await runPromise

        vi.useRealTimers()
    })
})
