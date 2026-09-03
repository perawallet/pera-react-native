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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { Platform } from 'react-native'

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

// Captured so a test can trigger the refresh React Navigation would run on
// focus, independent of the initial mount call.
let focusEffectCallback: (() => void) | null = null
const triggerFocus = () => focusEffectCallback?.()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate }),
    useFocusEffect: (callback: () => void) => {
        focusEffectCallback = callback
    },
}))

const { useLoginsQuery } = vi.hoisted(() => ({ useLoginsQuery: vi.fn() }))
vi.mock('@perawallet/wallet-core-passwords', () => ({ useLoginsQuery }))

const { usePasskeyAutofillStatus, mockAutofillServiceStatus } = vi.hoisted(
    () => ({
        usePasskeyAutofillStatus: vi.fn(),
        mockAutofillServiceStatus: vi.fn(),
    }),
)
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeyAutofillStatus,
    useAutofillServiceStatus: mockAutofillServiceStatus,
}))

const { openCredentialProviderSettings } = vi.hoisted(() => ({
    openCredentialProviderSettings: vi.fn(),
}))
vi.mock(
    '@modules/settings/screens/SettingsPasskeysScreen/openCredentialProviderSettings',
    () => ({ openCredentialProviderSettings }),
)

import { usePasswordListScreen } from '../usePasswordListScreen'

const login = {
    id: 'pera.login.abc',
    domain: 'example.com',
    username: 'ada@example.com',
    note: null,
    createdAt: 1,
    updatedAt: 1,
}

const openProviderSettings = vi.fn()

describe('usePasswordListScreen', () => {
    beforeEach(() => {
        usePasskeyAutofillStatus.mockReturnValue({
            isProviderActive: true,
            openProviderSettings,
            refresh: vi.fn(),
        })
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: false,
            status: 'active',
            refresh: vi.fn(),
            openAutofillSettings: vi.fn(async () => true),
        })
        Platform.OS = 'android'
    })

    it('exposes the stored logins and the provider state', () => {
        useLoginsQuery.mockReturnValue({ logins: [login], isLoading: false })
        usePasskeyAutofillStatus.mockReturnValue({
            isProviderActive: true,
            openProviderSettings,
        })

        const { result } = renderHook(() => usePasswordListScreen())

        expect(result.current.logins).toEqual([login])
        expect(result.current.isProviderActive).toBe(true)
    })

    it('navigates to the add screen', () => {
        useLoginsQuery.mockReturnValue({ logins: [], isLoading: false })
        usePasskeyAutofillStatus.mockReturnValue({
            isProviderActive: false,
            openProviderSettings,
        })

        const { result } = renderHook(() => usePasswordListScreen())
        result.current.handleAdd()

        expect(navigate).toHaveBeenCalledWith('AddPassword')
    })

    it('navigates to a login with its id', () => {
        useLoginsQuery.mockReturnValue({ logins: [login], isLoading: false })
        usePasskeyAutofillStatus.mockReturnValue({
            isProviderActive: true,
            openProviderSettings,
        })

        const { result } = renderHook(() => usePasswordListScreen())
        result.current.handleSelect('pera.login.abc')

        expect(navigate).toHaveBeenCalledWith('ViewPassword', {
            id: 'pera.login.abc',
        })
    })

    it('opens system settings when the provider is not active', () => {
        useLoginsQuery.mockReturnValue({ logins: [], isLoading: false })
        usePasskeyAutofillStatus.mockReturnValue({
            isProviderActive: false,
            openProviderSettings,
        })

        const { result } = renderHook(() => usePasswordListScreen())
        result.current.handleEnableProvider()

        expect(openCredentialProviderSettings).toHaveBeenCalledWith(
            openProviderSettings,
        )
    })

    it('asks for the autofill banner when the service is off on Android', () => {
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: false,
            status: 'inactive',
            refresh: vi.fn(),
            openAutofillSettings: vi.fn(async () => true),
        })

        const { result } = renderHook(() => usePasswordListScreen())

        expect(result.current.autofillBanner).toBe('inactive')
    })

    it('hides the autofill banner on iOS, where there is no autofill service to enable', () => {
        // The native methods are Android-only, so the query rejects and reports
        // 'unsupported' — which as a banner would tell an iOS user their OS
        // cannot fill passwords while its credential provider is doing so.
        Platform.OS = 'ios'
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: false,
            status: 'unsupported',
            refresh: vi.fn(),
            openAutofillSettings: vi.fn(async () => true),
        })

        const { result } = renderHook(() => usePasswordListScreen())

        expect(result.current.autofillBanner).toBe('hidden')
    })

    it('hides the autofill banner until the status check resolves', () => {
        // status defaults to 'inactive' before the query settles, so rendering
        // on it would flash an enable action at a device that is already on.
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: true,
            status: 'inactive',
            refresh: vi.fn(),
            openAutofillSettings: vi.fn(async () => true),
        })

        const { result } = renderHook(() => usePasswordListScreen())

        expect(result.current.autofillBanner).toBe('hidden')
    })

    it('reports an unsupported Android version as a dead end, not an action', () => {
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: false,
            status: 'unsupported',
            refresh: vi.fn(),
            openAutofillSettings: vi.fn(async () => true),
        })

        const { result } = renderHook(() => usePasswordListScreen())

        expect(result.current.autofillBanner).toBe('unsupported')
    })

    it('opens autofill settings through the native fallback', async () => {
        const openAutofillSettings = vi.fn(async () => true)
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: false,
            status: 'inactive',
            refresh: vi.fn(),
            openAutofillSettings,
        })

        const { result } = renderHook(() => usePasswordListScreen())
        result.current.handleEnableAutofill()

        await waitFor(() => expect(openAutofillSettings).toHaveBeenCalled())
    })

    it('refreshes both statuses when the screen regains focus', () => {
        const refresh = vi.fn()
        mockAutofillServiceStatus.mockReturnValue({
            isLoading: false,
            status: 'inactive',
            refresh,
            openAutofillSettings: vi.fn(async () => true),
        })

        renderHook(() => usePasswordListScreen())
        triggerFocus()

        expect(refresh).toHaveBeenCalled()
    })
})
