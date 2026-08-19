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
import { renderHook } from '@testing-library/react'
import { Platform } from 'react-native'

const requestEnable = vi.fn()
const openSettings = vi.fn()
const openLocationSettings = vi.fn()

vi.mock('../useBluetoothState', () => ({
    useBluetoothState: () => ({
        adapterState: 'poweredOff',
        isBluetoothReady: false,
        isBluetoothUnavailable: true,
        requestEnable,
    }),
}))

vi.mock('../useBlePermissions', () => ({
    useBlePermissions: () => ({
        hasPermissions: true,
        isChecking: false,
        isBlocked: false,
        requestPermissions: vi.fn(),
        openSettings,
        openLocationSettings,
    }),
}))

import { useLedgerErrorAction } from '../useLedgerErrorAction'

describe('useLedgerErrorAction', () => {
    beforeEach(() => {
        requestEnable.mockReset()
        openSettings.mockReset()
        openLocationSettings.mockReset()
        requestEnable.mockResolvedValue(true)
        Platform.OS = 'android'
    })

    it('asks the OS to turn Bluetooth on without leaving the app on Android', async () => {
        const { result } = renderHook(() => useLedgerErrorAction())

        result.current.runAction('bluetooth')
        await vi.waitFor(() => expect(requestEnable).toHaveBeenCalledOnce())

        expect(openSettings).not.toHaveBeenCalled()
    })

    it('falls back to Settings when the Android dialog could not be shown', async () => {
        requestEnable.mockResolvedValue(false)
        const { result } = renderHook(() => useLedgerErrorAction())

        result.current.runAction('bluetooth')

        await vi.waitFor(() => expect(openSettings).toHaveBeenCalledOnce())
    })

    it('goes straight to Settings on iOS, which cannot report whether its power alert appeared', () => {
        // iOS `requestEnable` resolves true even when the alert is suppressed,
        // so a result-keyed fallback left the button doing nothing at all.
        Platform.OS = 'ios'
        const { result } = renderHook(() => useLedgerErrorAction())

        result.current.runAction('bluetooth')

        expect(openSettings).toHaveBeenCalledOnce()
        expect(requestEnable).not.toHaveBeenCalled()
    })

    it('routes location and permission actions to their own destinations', () => {
        const { result } = renderHook(() => useLedgerErrorAction())

        result.current.runAction('location')
        expect(openLocationSettings).toHaveBeenCalledOnce()
        expect(requestEnable).not.toHaveBeenCalled()

        result.current.runAction('app_settings')
        expect(openSettings).toHaveBeenCalledOnce()
    })
})
