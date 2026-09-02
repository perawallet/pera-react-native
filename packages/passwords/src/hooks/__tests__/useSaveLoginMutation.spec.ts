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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

// vi.mock factories run before the rest of this module is evaluated, so
// the mocked fns can only be shared via vi.hoisted.
const { saveLogin, publishLoginIdentities, service } = vi.hoisted(() => ({
    saveLogin: vi.fn(),
    publishLoginIdentities: vi.fn(async () => undefined),
    service: { replacePasswordCredentialIdentities: vi.fn() },
}))

vi.mock('../../storage/loginStore', () => ({ saveLogin }))
vi.mock('../../identities/publishIdentities', () => ({
    publishLoginIdentities,
}))
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeyAutofillService: () => service,
}))

import { useSaveLoginMutation } from '../useSaveLoginMutation'

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

const input = {
    domain: 'example.com',
    username: 'ada@example.com',
    password: 'secret',
    note: null,
}

describe('useSaveLoginMutation', () => {
    it('writes the login and republishes the OS index', async () => {
        saveLogin.mockResolvedValue({ id: 'pera.login.abc' })

        const { result } = renderHook(() => useSaveLoginMutation(), { wrapper })
        await result.current.saveLogin(input)

        expect(saveLogin).toHaveBeenCalledWith(input)
        await waitFor(() =>
            expect(publishLoginIdentities).toHaveBeenCalledWith(service),
        )
    })

    it('does not publish when the write fails', async () => {
        publishLoginIdentities.mockClear()
        saveLogin.mockRejectedValue(new Error('keystore unavailable'))

        const { result } = renderHook(() => useSaveLoginMutation(), { wrapper })
        await expect(result.current.saveLogin(input)).rejects.toThrow(
            'keystore unavailable',
        )

        expect(publishLoginIdentities).not.toHaveBeenCalled()
    })
})
