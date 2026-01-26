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

import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '../../../test-utils'

describe('device/store', () => {
    beforeEach(() => {
        // Reset modules to get fresh store instance
        vi.resetModules()
    })

    test('should initialize with default values', async () => {
        registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore()

        const { result } = renderHook(() => useDeviceStore())

        expect(result.current.deviceIDs).toBeInstanceOf(Map)
        expect(result.current.deviceIDs.size).toBe(0)
        expect(result.current.pushToken).toBeNull()
        expect(result.current.network).toBe('mainnet')
    })

    test('should set FCM token', async () => {
        registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore()

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setPushToken('test-token-123')
        })

        expect(result.current.pushToken).toBe('test-token-123')
    })

    test('should set device ID for network', async () => {
        registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore()

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('testnet', 'device-123')
        })

        expect(result.current.deviceIDs.get('testnet')).toBe('device-123')
    })

    test('should update device ID for same network', async () => {
        registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore()

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('mainnet', 'device-1')
        })

        act(() => {
            result.current.setDeviceID('mainnet', 'device-2')
        })

        expect(result.current.deviceIDs.get('mainnet')).toBe('device-2')
    })

    test('should set network', async () => {
        registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore()

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setNetwork('testnet')
        })

        expect(result.current.network).toBe('testnet')
    })
})
