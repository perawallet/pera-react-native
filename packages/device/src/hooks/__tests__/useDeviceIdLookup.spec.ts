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

// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useDeviceStore } from '../../store'
import { useDeviceIdLookup } from '../useDeviceIdLookup'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('device/hooks/useDeviceIdLookup', () => {
    beforeEach(() => {
        useDeviceStore.getState().resetState()
    })

    test('returns the id stored for the deployment', () => {
        act(() => {
            useDeviceStore
                .getState()
                .setDeviceID('developer', 'device-test-456')
        })

        const { result } = renderHook(() => useDeviceIdLookup())

        expect(result.current('developer')).toBe('device-test-456')
    })

    test('returns null for a deployment with no id, or no deployment', () => {
        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'device-main-123')
        })

        const { result } = renderHook(() => useDeviceIdLookup())

        expect(result.current('developer')).toBeNull()
        expect(result.current(null)).toBeNull()
    })

    test('returns a fresh lookup once an id is set', () => {
        const { result } = renderHook(() => useDeviceIdLookup())

        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'device-new-123')
        })

        expect(result.current('live')).toBe('device-new-123')
    })
})
