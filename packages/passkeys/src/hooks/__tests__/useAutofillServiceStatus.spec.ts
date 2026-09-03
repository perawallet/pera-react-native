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

import { useAutofillServiceStatus } from '../useAutofillServiceStatus'

type ServiceOverrides = {
    isAutofillServiceActive?: () => Promise<boolean>
    openAutofillSettings?: () => Promise<boolean>
}

const makeWrapper = (overrides: ServiceOverrides = {}) => {
    mocks.getProvider.mockReturnValue({
        passkeyAutofill: {
            isAutofillServiceActive:
                overrides.isAutofillServiceActive ??
                vi.fn().mockResolvedValue(false),
            openAutofillSettings:
                overrides.openAutofillSettings ??
                vi.fn().mockResolvedValue(false),
        },
    })

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

describe('useAutofillServiceStatus', () => {
    beforeEach(() => vi.clearAllMocks())

    it('reports active when the native service is enabled', async () => {
        const { result } = renderHook(() => useAutofillServiceStatus(), {
            wrapper: makeWrapper({ isAutofillServiceActive: async () => true }),
        })

        await waitFor(() => expect(result.current.status).toBe('active'))
    })

    it('reports unsupported below the autofill API level', async () => {
        const { result } = renderHook(() => useAutofillServiceStatus(), {
            wrapper: makeWrapper({
                isAutofillServiceActive: async () => {
                    throw new Error('unsupported')
                },
            }),
        })

        await waitFor(() => expect(result.current.status).toBe('unsupported'))
    })

    it('reports inactive when the service is supported but off', async () => {
        const { result } = renderHook(() => useAutofillServiceStatus(), {
            wrapper: makeWrapper({
                isAutofillServiceActive: async () => false,
            }),
        })

        await waitFor(() => expect(result.current.status).toBe('inactive'))
    })
})
