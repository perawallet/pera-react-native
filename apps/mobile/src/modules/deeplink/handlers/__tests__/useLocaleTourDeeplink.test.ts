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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockRunTourStep, mockRunTour, mockGetRunner } = vi.hoisted(() => {
    const runTourStep = vi.fn().mockResolvedValue(undefined)
    const runTour = vi.fn().mockResolvedValue(undefined)
    type Runner = { runTourStep: typeof runTourStep; runTour: typeof runTour }
    return {
        mockRunTourStep: runTourStep,
        mockRunTour: runTour,
        // Explicit `| undefined`: the no-runner case is a real build state, and
        // inference from the happy path alone would reject it.
        mockGetRunner: vi.fn((): Runner | undefined => ({
            runTourStep,
            runTour,
        })),
    }
})

vi.mock('@modules/locale-tour/registry', () => ({
    getLocaleTourRunner: mockGetRunner,
}))

import { useLocaleTourDeeplink } from '../useLocaleTourDeeplink'

describe('useLocaleTourDeeplink', () => {
    it('forwards locale and step to runTourStep as stepId', async () => {
        const { result } = renderHook(() => useLocaleTourDeeplink())

        await result.current({ locale: 'en-XA', step: 'scr-home' })

        expect(mockRunTourStep).toHaveBeenCalledWith({
            stepId: 'scr-home',
            locale: 'en-XA',
        })
        expect(mockRunTour).not.toHaveBeenCalled()
    })

    it('dispatches to runTour when run is "all", ignoring any step', async () => {
        const { result } = renderHook(() => useLocaleTourDeeplink())

        await result.current({ locale: 'en-XA', run: 'all' })

        expect(mockRunTour).toHaveBeenCalledWith({ locale: 'en-XA' })
        expect(mockRunTourStep).not.toHaveBeenCalled()
    })

    it('does nothing when neither step nor run is given', async () => {
        const { result } = renderHook(() => useLocaleTourDeeplink())

        await result.current({ locale: 'en-XA' })

        expect(mockRunTourStep).not.toHaveBeenCalled()
        expect(mockRunTour).not.toHaveBeenCalled()
    })

    // The release-build path: register.ts resolves to its stub, so nothing
    // ever registers a runner and a run: 'all' must be a silent no-op.
    it('no-ops when no runner is registered', async () => {
        mockGetRunner.mockReturnValueOnce(undefined)
        const { result } = renderHook(() => useLocaleTourDeeplink())

        await expect(
            result.current({ locale: 'en-XA', run: 'all' }),
        ).resolves.toBeUndefined()

        expect(mockRunTour).not.toHaveBeenCalled()
        expect(mockRunTourStep).not.toHaveBeenCalled()
    })
})
