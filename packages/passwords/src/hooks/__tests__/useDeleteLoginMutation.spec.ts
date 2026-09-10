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
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'

// vi.mock factories run before the rest of this module is evaluated, so
// the mocked fns can only be shared via vi.hoisted.
const { deleteLogin, publishLoginIdentities, pruneAppLinks, service } =
    vi.hoisted(() => {
        const pruneAppLinks = vi.fn(async () => undefined)
        return {
            deleteLogin: vi.fn(),
            publishLoginIdentities: vi.fn(async () => undefined),
            pruneAppLinks,
            service: {
                replacePasswordCredentialIdentities: vi.fn(),
                pruneAppLinks,
            },
        }
    })

vi.mock('../../storage/loginStore', () => ({ deleteLogin }))
vi.mock('../../identities/publishIdentities', () => ({
    publishLoginIdentities,
}))
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeyAutofillService: () => service,
}))

import { useDeleteLoginMutation } from '../useDeleteLoginMutation'

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

describe('useDeleteLoginMutation', () => {
    it('removes the login and republishes the OS index', async () => {
        deleteLogin.mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteLoginMutation(), {
            wrapper,
        })
        await result.current.deleteLogin('pera.login.abc')

        expect(deleteLogin).toHaveBeenCalledWith('pera.login.abc')
        await waitFor(() =>
            expect(publishLoginIdentities).toHaveBeenCalledWith(service),
        )
    })

    it('does not publish when the removal fails', async () => {
        publishLoginIdentities.mockClear()
        deleteLogin.mockRejectedValue(new Error('keystore unavailable'))

        const { result } = renderHook(() => useDeleteLoginMutation(), {
            wrapper,
        })
        await expect(
            result.current.deleteLogin('pera.login.abc'),
        ).rejects.toThrow('keystore unavailable')

        expect(publishLoginIdentities).not.toHaveBeenCalled()
    })

    it('prunes app links for the deleted login', async () => {
        deleteLogin.mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteLoginMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.deleteLogin('pera.login.abc')
        })

        expect(pruneAppLinks).toHaveBeenCalledWith('pera.login.abc')
    })

    it('still deletes when link pruning fails', async () => {
        deleteLogin.mockResolvedValue(undefined)
        pruneAppLinks.mockRejectedValueOnce(new Error('store unavailable'))

        const { result } = renderHook(() => useDeleteLoginMutation(), {
            wrapper,
        })

        await act(async () => {
            await result.current.deleteLogin('pera.login.abc')
        })

        expect(deleteLogin).toHaveBeenCalledWith('pera.login.abc')
    })
})
