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
import { act, renderHook, waitFor } from '@testing-library/react'

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
const { goBack } = vi.hoisted(() => ({ goBack: vi.fn() }))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack }),
}))

const { saveLogin, readLogin } = vi.hoisted(() => ({
    saveLogin: vi.fn(async () => ({ id: 'pera.login.abc' })),
    readLogin: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-passwords', () => ({
    useSaveLoginMutation: () => ({
        saveLogin,
        isPending: false,
        isError: false,
        error: null,
    }),
    readLogin,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useEditPasswordScreen } from '../useEditPasswordScreen'

describe('useEditPasswordScreen', () => {
    it('prefills every field from the stored login', async () => {
        readLogin.mockResolvedValue({
            id: 'pera.login.abc',
            domain: 'example.com',
            username: 'ada@example.com',
            password: 'secret',
            note: 'work',
            createdAt: 1,
            updatedAt: 1,
        })

        const { result } = renderHook(() =>
            useEditPasswordScreen('pera.login.abc'),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.domain).toBe('example.com')
        expect(result.current.username).toBe('ada@example.com')
        expect(result.current.password).toBe('secret')
        expect(result.current.note).toBe('work')
    })

    it('saves against the existing id so the record is updated in place', async () => {
        readLogin.mockResolvedValue({
            id: 'pera.login.abc',
            domain: 'example.com',
            username: 'ada@example.com',
            password: 'secret',
            note: null,
            createdAt: 1,
            updatedAt: 1,
        })

        const { result } = renderHook(() =>
            useEditPasswordScreen('pera.login.abc'),
        )
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        act(() => result.current.setPassword('rotated'))
        await act(() => result.current.handleSave())

        expect(saveLogin).toHaveBeenCalledWith({
            id: 'pera.login.abc',
            domain: 'example.com',
            username: 'ada@example.com',
            password: 'rotated',
            note: null,
        })
    })

    it('surfaces a rejecting readLogin as an error instead of an unhandled rejection', async () => {
        readLogin.mockRejectedValue(new Error('keystore is locked'))

        const { result } = renderHook(() =>
            useEditPasswordScreen('pera.login.abc'),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.error).toBe('keystore is locked')
        expect(result.current.domain).toBe('')
    })

    it('reports a deleted record and refuses to save over it', async () => {
        saveLogin.mockClear()
        readLogin.mockResolvedValue(null)

        const { result } = renderHook(() =>
            useEditPasswordScreen('pera.login.gone'),
        )
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        act(() => {
            result.current.setDomain('example.com')
            result.current.setPassword('secret')
        })
        await act(() => result.current.handleSave())

        expect(result.current.error).toBe('settings.passwords.not_found_body')
        expect(result.current.canSave).toBe(false)
        expect(saveLogin).not.toHaveBeenCalled()
    })

    it('swallows a rejected save and stays on the screen', async () => {
        goBack.mockClear()
        readLogin.mockResolvedValue({
            id: 'pera.login.abc',
            domain: 'example.com',
            username: 'ada@example.com',
            password: 'secret',
            note: null,
            createdAt: 1,
            updatedAt: 1,
        })
        saveLogin.mockRejectedValueOnce(new Error('keystore unavailable'))

        const { result } = renderHook(() =>
            useEditPasswordScreen('pera.login.abc'),
        )
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await act(() => result.current.handleSave())

        expect(goBack).not.toHaveBeenCalled()
    })
})
