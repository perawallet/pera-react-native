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

import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { PasskeyAutofillNativeAPI } from '@perawallet/wallet-extension-passkey-autofill'

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

// A minimal native double for methods `PasskeyAutofillService` always calls.
// `isAutofillServiceActive` is deliberately absent so the service's real
// absent-method handling runs, the way it would on iOS or a build predating
// the native work.
const makeNative = (
    overrides: Partial<PasskeyAutofillNativeAPI> = {},
): PasskeyAutofillNativeAPI =>
    ({
        setMasterKey: vi.fn().mockResolvedValue(undefined),
        setMainKeyId: vi.fn().mockResolvedValue(undefined),
        setHdRootKeyId: vi.fn().mockResolvedValue(undefined),
        configureIntentActions: vi.fn().mockResolvedValue(undefined),
        clearCredentials: vi.fn().mockResolvedValue(undefined),
        deleteCredential: vi.fn().mockResolvedValue(undefined),
        isProviderActive: vi.fn().mockResolvedValue(true),
        openProviderSettings: vi.fn().mockResolvedValue(true),
        addListener: vi.fn(() => ({ remove: vi.fn() })),
        ...overrides,
    }) as PasskeyAutofillNativeAPI

// Loads the real `PasskeyAutofillService` for the "unsupported" case below.
// The package barrel also pulls in `extension.ts`, which imports the native
// Expo module — unusable outside a real RN runtime — so that import and
// `react-native` need doubles. Both are resolved from the barrel's own
// dependency tree (via `createRequire`) rather than mocked by bare specifier:
// this package doesn't depend on either directly, so a same-file bare-specifier
// mock resolves against the wrong node_modules root in this pnpm workspace and
// silently fails to intercept the barrel's own imports.
const loadRealPasskeyAutofillService = async () => {
    const distEntry =
        require.resolve('@perawallet/wallet-extension-passkey-autofill')
    const requireFromDist = createRequire(distEntry)
    const nativePkgPath = requireFromDist.resolve(
        '@algorandfoundation/react-native-passkey-autofill',
    )
    const reactNativePath = requireFromDist.resolve('react-native')

    vi.doMock(nativePkgPath, () => ({ default: {} }))
    vi.doMock(reactNativePath, () => ({ Platform: { OS: 'ios' } }))

    const { PasskeyAutofillService } =
        await import('@perawallet/wallet-extension-passkey-autofill')
    return PasskeyAutofillService
}

const makeWrapperWithRealService = (
    service: InstanceType<
        Awaited<ReturnType<typeof loadRealPasskeyAutofillService>>
    >,
) => {
    mocks.getProvider.mockReturnValue({ passkeyAutofill: service })

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

    it('reports unsupported when the native module has no autofill capability', async () => {
        const PasskeyAutofillService = await loadRealPasskeyAutofillService()
        const service = new PasskeyAutofillService(makeNative())

        const { result } = renderHook(() => useAutofillServiceStatus(), {
            wrapper: makeWrapperWithRealService(service),
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
