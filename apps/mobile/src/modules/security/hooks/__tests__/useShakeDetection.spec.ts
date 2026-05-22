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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

type Sample = { x: number; y: number; z: number }
type Listener = (sample: Sample) => void

const accelerometerMock = vi.hoisted(() => {
    const listeners: Listener[] = []
    return {
        isAvailableAsync: vi.fn(async () => true),
        setUpdateInterval: vi.fn(),
        addListener: vi.fn((listener: Listener) => {
            listeners.push(listener)
            return {
                remove: () => {
                    const index = listeners.indexOf(listener)
                    if (index >= 0) listeners.splice(index, 1)
                },
            }
        }),
        emit: (sample: Sample) => {
            for (const listener of [...listeners]) listener(sample)
        },
        listenerCount: () => listeners.length,
        reset: () => {
            listeners.length = 0
        },
    }
})

vi.mock('expo-sensors', () => ({
    Accelerometer: accelerometerMock,
}))

import { useShakeDetection, COOLDOWN_MS } from '../useShakeDetection'

const flush = async () => {
    await act(async () => {
        await Promise.resolve()
    })
}

describe('useShakeDetection', () => {
    let onTrigger: ReturnType<typeof vi.fn> & (() => void)

    beforeEach(() => {
        vi.clearAllMocks()
        accelerometerMock.reset()
        accelerometerMock.isAvailableAsync.mockResolvedValue(true)
        onTrigger = vi.fn() as ReturnType<typeof vi.fn> & (() => void)
    })

    test('does not subscribe when disabled', async () => {
        renderHook(() => useShakeDetection({ enabled: false, onTrigger }))
        await flush()
        expect(accelerometerMock.addListener).not.toHaveBeenCalled()
        expect(accelerometerMock.listenerCount()).toBe(0)
    })

    test('subscribes when enabled', async () => {
        renderHook(() => useShakeDetection({ enabled: true, onTrigger }))
        await flush()
        expect(accelerometerMock.addListener).toHaveBeenCalledTimes(1)
        expect(accelerometerMock.listenerCount()).toBe(1)
    })

    test('unsubscribes when enabled flips to false', async () => {
        const { rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) =>
                useShakeDetection({ enabled, onTrigger }),
            { initialProps: { enabled: true } },
        )
        await flush()
        expect(accelerometerMock.listenerCount()).toBe(1)

        rerender({ enabled: false })
        await flush()
        expect(accelerometerMock.listenerCount()).toBe(0)
    })

    test('does not subscribe when the sensor reports unavailable', async () => {
        accelerometerMock.isAvailableAsync.mockResolvedValue(false)
        renderHook(() => useShakeDetection({ enabled: true, onTrigger }))
        await flush()
        expect(accelerometerMock.addListener).not.toHaveBeenCalled()
        expect(onTrigger).not.toHaveBeenCalled()
    })

    test('fires on a single jerk above the threshold', async () => {
        renderHook(() => useShakeDetection({ enabled: true, onTrigger }))
        await flush()

        // Single sample with very high total magnitude.
        accelerometerMock.emit({ x: 3, y: 0, z: 0 })
        expect(onTrigger).toHaveBeenCalledTimes(1)
    })

    test('fires on a back-and-forth shake gesture', async () => {
        renderHook(() => useShakeDetection({ enabled: true, onTrigger }))
        await flush()

        // Each sample is below the jerk threshold (2.5g) but above the
        // shake-floor (1.7g), with reversing sign on the x axis.
        accelerometerMock.emit({ x: 2, y: 0, z: 0 })
        accelerometerMock.emit({ x: -2, y: 0, z: 0 })
        accelerometerMock.emit({ x: 2, y: 0, z: 0 })
        accelerometerMock.emit({ x: -2, y: 0, z: 0 })

        expect(onTrigger).toHaveBeenCalledTimes(1)
    })

    test('cooldown suppresses back-to-back triggers', async () => {
        vi.useFakeTimers()
        const startedAt = Date.now()
        vi.setSystemTime(startedAt)

        renderHook(() => useShakeDetection({ enabled: true, onTrigger }))
        await flush()

        accelerometerMock.emit({ x: 3, y: 0, z: 0 })
        expect(onTrigger).toHaveBeenCalledTimes(1)

        // Inside the cooldown window — no second trigger.
        vi.setSystemTime(startedAt + 500)
        accelerometerMock.emit({ x: 3, y: 0, z: 0 })
        expect(onTrigger).toHaveBeenCalledTimes(1)

        // After the cooldown — a fresh jerk should trigger.
        vi.setSystemTime(startedAt + COOLDOWN_MS + 10)
        accelerometerMock.emit({ x: 3, y: 0, z: 0 })
        expect(onTrigger).toHaveBeenCalledTimes(2)

        vi.useRealTimers()
    })

    test('uses the latest onTrigger reference when callback identity changes', async () => {
        const first = vi.fn()
        const second = vi.fn()
        const { rerender } = renderHook(
            ({ cb }: { cb: () => void }) =>
                useShakeDetection({ enabled: true, onTrigger: cb }),
            { initialProps: { cb: first } },
        )
        await flush()

        rerender({ cb: second })
        await flush()

        accelerometerMock.emit({ x: 3, y: 0, z: 0 })
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })
})
