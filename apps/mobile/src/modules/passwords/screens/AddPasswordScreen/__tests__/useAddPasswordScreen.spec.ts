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
import { act, renderHook } from '@testing-library/react'

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
const { goBack } = vi.hoisted(() => ({ goBack: vi.fn() }))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack }),
}))

const { saveLogin } = vi.hoisted(() => ({
    saveLogin: vi.fn(async () => ({ id: 'pera.login.abc' })),
}))
vi.mock('@perawallet/wallet-core-passwords', () => ({
    useSaveLoginMutation: () => ({
        saveLogin,
        isPending: false,
        isError: false,
        error: null,
    }),
}))

import { useAddPasswordScreen } from '../useAddPasswordScreen'

describe('useAddPasswordScreen', () => {
    it('cannot save until a domain and a password are present', () => {
        const { result } = renderHook(() => useAddPasswordScreen())

        expect(result.current.canSave).toBe(false)

        act(() => result.current.setDomain('example.com'))
        expect(result.current.canSave).toBe(false)

        act(() => result.current.setPassword('secret'))
        expect(result.current.canSave).toBe(true)
    })

    it('saves the trimmed field values and returns to the list', async () => {
        const { result } = renderHook(() => useAddPasswordScreen())

        act(() => {
            result.current.setDomain('  example.com  ')
            result.current.setUsername('  ada@example.com  ')
            result.current.setPassword('secret')
        })
        await act(() => result.current.handleSave())

        expect(saveLogin).toHaveBeenCalledWith({
            domain: 'example.com',
            username: 'ada@example.com',
            password: 'secret',
            note: null,
        })
        expect(goBack).toHaveBeenCalled()
    })

    it('does not save when the form is incomplete', async () => {
        saveLogin.mockClear()
        const { result } = renderHook(() => useAddPasswordScreen())

        await act(() => result.current.handleSave())

        expect(saveLogin).not.toHaveBeenCalled()
    })
})
