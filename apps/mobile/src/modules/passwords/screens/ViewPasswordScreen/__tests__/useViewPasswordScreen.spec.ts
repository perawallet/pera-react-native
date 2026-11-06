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
import { act, renderHook } from '@testing-library/react'

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
const { goBack, navigate } = vi.hoisted(() => ({
    goBack: vi.fn(),
    navigate: vi.fn(),
}))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack, navigate }),
}))

const login = {
    id: 'pera.login.abc',
    domain: 'example.com',
    username: 'ada@example.com',
    note: null,
    createdAt: 1,
    updatedAt: 1,
}

const { loginsState } = vi.hoisted(() => ({
    loginsState: { logins: [] as unknown[], isLoading: false },
}))

const { readLogin, deleteLogin } = vi.hoisted(() => ({
    readLogin: vi.fn(async () => ({ ...login, password: 'secret' })),
    deleteLogin: vi.fn(async () => undefined),
}))
vi.mock('@perawallet/wallet-core-passwords', () => ({
    useLoginsQuery: () => loginsState,
    readLogin,
    useDeleteLoginMutation: () => ({
        deleteLogin,
        isPending: false,
        isError: false,
        error: null,
    }),
}))

const { copyToClipboard } = vi.hoisted(() => ({ copyToClipboard: vi.fn() }))
vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard, readText: vi.fn() }),
}))

const { errorToast } = vi.hoisted(() => ({ errorToast: vi.fn() }))
vi.mock('@hooks/useToast', () => ({ useToast: () => ({ errorToast }) }))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useViewPasswordScreen } from '../useViewPasswordScreen'

describe('useViewPasswordScreen', () => {
    beforeEach(() => {
        loginsState.logins = [login]
        loginsState.isLoading = false
        errorToast.mockClear()
    })

    it('keeps the password null until the user reveals it', async () => {
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        expect(result.current.password).toBeNull()
        expect(result.current.isRevealed).toBe(false)

        await act(() => result.current.handleToggleReveal())

        expect(result.current.password).toBe('secret')
        expect(result.current.isRevealed).toBe(true)
    })

    it('clears the plaintext when hidden again', async () => {
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        await act(() => result.current.handleToggleReveal())
        await act(() => result.current.handleToggleReveal())

        expect(result.current.password).toBeNull()
        expect(result.current.isRevealed).toBe(false)
    })

    it('deletes the login and returns to the list', async () => {
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        await act(() => result.current.handleDelete())

        expect(deleteLogin).toHaveBeenCalledWith('pera.login.abc')
        expect(goBack).toHaveBeenCalled()
    })

    it('copies the revealed password to the clipboard', async () => {
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        await act(() => result.current.handleCopy())

        expect(copyToClipboard).toHaveBeenCalledWith('secret')
    })

    it('navigates to the edit screen', () => {
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        result.current.handleEdit()

        expect(navigate).toHaveBeenCalledWith('EditPassword', {
            id: 'pera.login.abc',
        })
    })

    it('toasts instead of rejecting when revealing fails', async () => {
        readLogin.mockRejectedValueOnce(new Error('keystore locked'))
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        await act(() => result.current.handleToggleReveal())

        expect(errorToast).toHaveBeenCalledWith(
            'common.error.title',
            'common.error.body',
        )
        expect(result.current.password).toBeNull()
    })

    it('toasts instead of rejecting when copying fails', async () => {
        copyToClipboard.mockClear()
        readLogin.mockRejectedValueOnce(new Error('keystore locked'))
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        await act(() => result.current.handleCopy())

        expect(errorToast).toHaveBeenCalledTimes(1)
        expect(copyToClipboard).not.toHaveBeenCalled()
    })

    it('reports not found once loading ends without the login', () => {
        loginsState.logins = []
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        expect(result.current.isNotFound).toBe(true)
    })

    it('is not "not found" while the list is still loading', () => {
        loginsState.logins = []
        loginsState.isLoading = true
        const { result } = renderHook(() =>
            useViewPasswordScreen('pera.login.abc'),
        )

        expect(result.current.isNotFound).toBe(false)
    })
})
