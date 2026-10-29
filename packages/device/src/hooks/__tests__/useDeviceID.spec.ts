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
import { useDeploymentDeviceID } from '../useDeviceID'

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

describe('device/hooks/useDeviceID', () => {
    // resetState rather than vi.resetModules + per-test dynamic imports: the
    // latter re-transformed the store's whole module graph every test and
    // intermittently overran the 5s timeout under the full parallel run.
    beforeEach(() => {
        useDeviceStore.getState().resetState()
    })

    test('returns null when no device ID is set', () => {
        const { result } = renderHook(() => useDeploymentDeviceID('live'))

        expect(result.current).toBeNull()
    })

    test('returns null for a deployment without a device ID', () => {
        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'device-123')
        })

        const developer = renderHook(() => useDeploymentDeviceID('developer'))

        expect(developer.result.current).toBeNull()
    })

    test('updates when the device ID changes', () => {
        const hook = renderHook(() => useDeploymentDeviceID('live'))

        expect(hook.result.current).toBeNull()

        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'device-new-123')
        })

        expect(hook.result.current).toBe('device-new-123')
    })

    test('returns null for no deployment', () => {
        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'device-123')
        })

        expect(
            renderHook(() => useDeploymentDeviceID(null)).result.current,
        ).toBeNull()
    })

    test('reads the device ID by deployment', () => {
        act(() => {
            useDeviceStore.getState().setDeviceID('live', 'device-main-123')
            useDeviceStore
                .getState()
                .setDeviceID('developer', 'device-test-456')
        })

        expect(
            renderHook(() => useDeploymentDeviceID('live')).result.current,
        ).toBe('device-main-123')
        expect(
            renderHook(() => useDeploymentDeviceID('developer')).result.current,
        ).toBe('device-test-456')
    })
})
