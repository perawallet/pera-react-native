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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mocks = vi.hoisted(() => ({
    getProvider: vi.fn(),
    warn: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: mocks.getProvider,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: mocks.warn, error: vi.fn() },
}))

import { usePasskeyAutofillStatus } from '../usePasskeyAutofillStatus'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

type ServiceOverrides = {
    isProviderActive?: () => Promise<boolean>
    openProviderSettings?: () => Promise<boolean>
}

const wireService = (overrides: ServiceOverrides = {}) => {
    mocks.getProvider.mockReturnValue({
        passkeyAutofill: {
            isProviderActive:
                overrides.isProviderActive ?? vi.fn().mockResolvedValue(false),
            openProviderSettings:
                overrides.openProviderSettings ??
                vi.fn().mockResolvedValue(false),
        },
    })
}

describe('usePasskeyAutofillStatus', () => {
    beforeEach(() => vi.clearAllMocks())

    it('reports the provider as active when the native check resolves true', async () => {
        wireService({ isProviderActive: vi.fn().mockResolvedValue(true) })

        const { result } = renderHook(() => usePasskeyAutofillStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isProviderActive).toBe(true))
    })

    it('reports the provider as inactive when the native check resolves false', async () => {
        wireService({ isProviderActive: vi.fn().mockResolvedValue(false) })

        const { result } = renderHook(() => usePasskeyAutofillStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isProviderActive).toBe(false)
    })

    it('treats a thrown native check as "not active" and logs a warning', async () => {
        wireService({
            isProviderActive: vi
                .fn()
                .mockRejectedValue(new Error('unsupported OS')),
        })

        const { result } = renderHook(() => usePasskeyAutofillStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isProviderActive).toBe(false)
        expect(mocks.warn).toHaveBeenCalled()
    })

    it('returns the native result from openProviderSettings', async () => {
        wireService({ openProviderSettings: vi.fn().mockResolvedValue(true) })

        const { result } = renderHook(() => usePasskeyAutofillStatus(), {
            wrapper: createWrapper(),
        })

        await expect(result.current.openProviderSettings()).resolves.toBe(true)
    })

    it('resolves openProviderSettings to false and warns when the native call throws', async () => {
        wireService({
            openProviderSettings: vi
                .fn()
                .mockRejectedValue(new Error('no settings deep link')),
        })

        const { result } = renderHook(() => usePasskeyAutofillStatus(), {
            wrapper: createWrapper(),
        })

        await expect(result.current.openProviderSettings()).resolves.toBe(false)
        expect(mocks.warn).toHaveBeenCalled()
    })
})
