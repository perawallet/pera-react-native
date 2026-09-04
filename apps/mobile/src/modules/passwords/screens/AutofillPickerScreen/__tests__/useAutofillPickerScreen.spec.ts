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
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
const {
    autofillPickerReady,
    requestAutofillUnlock,
    resolveAutofillPick,
    cancelAutofillPick,
} = vi.hoisted(() => ({
    autofillPickerReady: vi.fn(),
    requestAutofillUnlock: vi.fn(async () => true),
    resolveAutofillPick: vi.fn(),
    cancelAutofillPick: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeyAutofillService: () => ({
        autofillPickerReady,
        requestAutofillUnlock,
        resolveAutofillPick,
        cancelAutofillPick,
    }),
}))

const login = {
    id: 'pera.login.abc',
    domain: 'example.com',
    username: 'ada@example.com',
    note: null,
}

const { useLoginsQuery } = vi.hoisted(() => ({ useLoginsQuery: vi.fn() }))
vi.mock('@perawallet/wallet-core-passwords', () => ({ useLoginsQuery }))

import { useAutofillPickerScreen } from '../useAutofillPickerScreen'

const caller = {
    packageName: 'com.example.app',
    label: 'Example',
    host: 'example.com',
}

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

describe('useAutofillPickerScreen', () => {
    beforeEach(() => {
        useLoginsQuery.mockReturnValue({
            logins: [login],
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        })
        autofillPickerReady.mockClear()
        requestAutofillUnlock.mockClear()
        resolveAutofillPick.mockClear()
        cancelAutofillPick.mockClear()
    })

    it('signals readiness on mount', () => {
        renderHook(() => useAutofillPickerScreen(caller), { wrapper })

        expect(autofillPickerReady).toHaveBeenCalled()
    })

    it('puts the package first and caps the label', () => {
        const { result } = renderHook(
            () =>
                useAutofillPickerScreen({
                    packageName: 'com.evil',
                    label: 'x'.repeat(200),
                    host: null,
                }),
            { wrapper },
        )

        expect(result.current.callerText.indexOf('com.evil')).toBe(0)
        expect(result.current.callerText.length).toBeLessThan(80)
    })

    it('strips newlines and bidi overrides from the label', () => {
        const { result } = renderHook(
            () =>
                useAutofillPickerScreen({
                    packageName: 'com.evil',
                    label: 'Chrome\n‮gnihsihp',
                    host: null,
                }),
            { wrapper },
        )

        expect(result.current.callerText).not.toContain('\n')
        expect(result.current.callerText).not.toContain('‮')
    })

    it('exposes no logins before unlock', () => {
        const { result } = renderHook(() => useAutofillPickerScreen(caller), {
            wrapper,
        })

        expect(result.current.isUnlocked).toBe(false)
        expect(result.current.logins).toEqual([])
    })

    it('exposes logins once unlock succeeds', async () => {
        requestAutofillUnlock.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useAutofillPickerScreen(caller), {
            wrapper,
        })

        await act(async () => {
            result.current.handleUnlock()
        })

        await waitFor(() => expect(result.current.isUnlocked).toBe(true))
        expect(result.current.logins).toHaveLength(1)
    })

    it('stays locked when unlock is refused', async () => {
        requestAutofillUnlock.mockResolvedValueOnce(false)
        const { result } = renderHook(() => useAutofillPickerScreen(caller), {
            wrapper,
        })

        await act(async () => {
            result.current.handleUnlock()
        })

        expect(result.current.isUnlocked).toBe(false)
        expect(result.current.logins).toEqual([])
    })

    it('forwards a selection and a cancel to the service', async () => {
        const { result } = renderHook(() => useAutofillPickerScreen(caller), {
            wrapper,
        })

        result.current.handleSelect('pera.login.abc')
        result.current.handleCancel()

        await waitFor(() =>
            expect(resolveAutofillPick).toHaveBeenCalledWith('pera.login.abc'),
        )
        expect(cancelAutofillPick).toHaveBeenCalled()
    })
})
