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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import * as Haptics from 'expo-haptics'

const mocks = vi.hoisted(() => ({
    isEnabled: true,
    capabilities: { hapticFeedback: true },
}))

vi.mock('../useHapticFeedbackSetting', () => ({
    isHapticFeedbackEnabled: () => mocks.isEnabled,
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mocks.capabilities,
}))

import {
    CHART_TICK_INTERVAL_MS,
    useHaptics,
    type UseHapticsResult,
} from '../useHaptics'

const notification = (type: string) => () =>
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(type)
const impact = (style: string) => () =>
    expect(Haptics.impactAsync).toHaveBeenCalledWith(style)
const selection = () => expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1)

const MAPPING: [keyof UseHapticsResult, () => void][] = [
    ['success', notification('success')],
    ['error', notification('error')],
    ['warning', notification('warning')],
    ['selection', selection],
    ['light', impact('light')],
    ['medium', impact('medium')],
    ['heavy', impact('heavy')],
    ['txSuccess', notification('success')],
    ['txError', notification('error')],
    ['copy', impact('light')],
    ['scanLock', impact('medium')],
    ['pinDigit', selection],
    ['pinError', notification('error')],
    ['chartTick', selection],
]

describe('useHaptics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isEnabled = true
        mocks.capabilities.hapticFeedback = true
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it.each(MAPPING)('%s plays its mapped haptic', (method, assertPlayed) => {
        const { result } = renderHook(() => useHaptics())

        result.current[method]()

        assertPlayed()
    })

    it('does nothing from any method when the setting is off', () => {
        mocks.isEnabled = false
        const { result } = renderHook(() => useHaptics())

        for (const [method] of MAPPING) result.current[method]()

        expect(Haptics.notificationAsync).not.toHaveBeenCalled()
        expect(Haptics.impactAsync).not.toHaveBeenCalled()
        expect(Haptics.selectionAsync).not.toHaveBeenCalled()
    })

    it('does nothing from any method when the platform has no haptics capability', () => {
        mocks.capabilities.hapticFeedback = false
        const { result } = renderHook(() => useHaptics())

        for (const [method] of MAPPING) result.current[method]()

        expect(Haptics.notificationAsync).not.toHaveBeenCalled()
        expect(Haptics.impactAsync).not.toHaveBeenCalled()
        expect(Haptics.selectionAsync).not.toHaveBeenCalled()
    })

    it('follows the setting after it changes, without a re-render', () => {
        mocks.isEnabled = false
        const { result } = renderHook(() => useHaptics())
        result.current.light()
        expect(Haptics.impactAsync).not.toHaveBeenCalled()

        mocks.isEnabled = true
        result.current.light()

        expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)
    })

    it('keeps the same methods across re-renders', () => {
        const { result, rerender } = renderHook(() => useHaptics())
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })

    it('swallows a rejected haptic without throwing or logging', async () => {
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.mocked(Haptics.notificationAsync).mockRejectedValueOnce(
            new Error('no haptics'),
        )
        const { result } = renderHook(() => useHaptics())

        expect(() => result.current.success()).not.toThrow()
        await Promise.resolve()
        await Promise.resolve()

        expect(errorLog).not.toHaveBeenCalled()
        errorLog.mockRestore()
    })

    it('swallows a synchronous throw from a missing native module', () => {
        vi.mocked(Haptics.impactAsync).mockImplementationOnce(() => {
            throw new Error('module missing')
        })
        const { result } = renderHook(() => useHaptics())

        expect(() => result.current.light()).not.toThrow()
    })

    it('throttles chartTick but not pinDigit', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        const { result } = renderHook(() => useHaptics())

        result.current.chartTick()
        vi.advanceTimersByTime(CHART_TICK_INTERVAL_MS - 1)
        result.current.chartTick()
        expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1)

        vi.advanceTimersByTime(1)
        result.current.chartTick()
        expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2)

        result.current.pinDigit()
        result.current.pinDigit()
        expect(Haptics.selectionAsync).toHaveBeenCalledTimes(4)
    })
})
