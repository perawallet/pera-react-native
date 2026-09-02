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

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate }),
}))

const { useLoginsQuery } = vi.hoisted(() => ({ useLoginsQuery: vi.fn() }))
vi.mock('@perawallet/wallet-core-passwords', () => ({ useLoginsQuery }))

const { usePasskeyAutofillStatus } = vi.hoisted(() => ({
    usePasskeyAutofillStatus: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeyAutofillStatus,
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
})
