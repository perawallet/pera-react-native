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

import { act, renderHook } from '@testing-library/react'
import { Platform } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories run before the rest of this module is evaluated, so
// each mocked fn can only be shared via vi.hoisted.
let appStateListener: (state: string) => void = () => undefined
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<typeof import('react-native')>()
    return {
        ...actual,
        AppState: {
            ...actual.AppState,
            addEventListener: (
                _event: string,
                listener: (state: string) => void,
            ) => {
                appStateListener = listener
                return { remove: vi.fn() }
            },
        },
    }
})

const { bootstrapPasskeyAutofill } = vi.hoisted(() => ({
    bootstrapPasskeyAutofill: vi.fn(async () => undefined),
}))
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    bootstrapPasskeyAutofill,
}))

const service = {
    onPasskeyAdded: vi.fn(() => ({ remove: vi.fn() })),
    onPasskeyAuthenticated: vi.fn(() => ({ remove: vi.fn() })),
    replacePasswordCredentialIdentities: vi.fn(async () => undefined),
}

const { getKeystoreStore, getProvider, reconcileKeystore } = vi.hoisted(() => ({
    getKeystoreStore: vi.fn(),
    getProvider: vi.fn(),
    reconcileKeystore: vi.fn(async () => ({ failedIds: [] })),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore,
    getProvider,
    reconcileKeystore,
}))

const { publishLoginIdentities, clearLoginIdentities } = vi.hoisted(() => ({
    publishLoginIdentities: vi.fn(),
    clearLoginIdentities: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-passwords', () => ({
    publishLoginIdentities,
    clearLoginIdentities,
}))

const { buildFlags, passwordManager } = vi.hoisted(() => ({
    buildFlags: { isProd: false },
    passwordManager: { isEnabled: true },
}))
vi.mock('@perawallet/wallet-core-config', () => buildFlags)
vi.mock('@hooks/useIsPasswordManagerEnabled', () => ({
    useIsPasswordManagerEnabled: () => passwordManager.isEnabled,
}))

import { usePasskeyAutofillLifecycle } from '../passkey-autofill'

const mockKeystore = (keyCount: number) => {
    let listener: () => void = () => undefined
    const state = { keys: Array.from({ length: keyCount }, () => ({})) }
    getKeystoreStore.mockReturnValue({
        state,
        subscribe: vi.fn((cb: () => void) => {
            listener = cb
            return { unsubscribe: vi.fn() }
        }),
    })
    return (nextCount: number) => {
        state.keys = Array.from({ length: nextCount }, () => ({}))
        listener()
    }
}

describe('usePasskeyAutofillLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Platform.OS = 'ios'
        buildFlags.isProd = false
        passwordManager.isEnabled = true
        getProvider.mockReturnValue({ passkeyAutofill: service })
        mockKeystore(0)
    })

    it('republishes password identities on foreground when enabled on iOS', async () => {
        renderHook(() => usePasskeyAutofillLifecycle())

        await act(async () => {
            appStateListener('active')
        })

        expect(publishLoginIdentities).toHaveBeenCalledWith(service)
        expect(clearLoginIdentities).not.toHaveBeenCalled()
    })

    it('publishes an empty set instead when the flag is off', async () => {
        passwordManager.isEnabled = false
        renderHook(() => usePasskeyAutofillLifecycle())

        await act(async () => {
            appStateListener('active')
        })

        expect(clearLoginIdentities).toHaveBeenCalledWith(service)
        expect(publishLoginIdentities).not.toHaveBeenCalled()
    })

    it('never touches the vault on Android', async () => {
        Platform.OS = 'android'
        renderHook(() => usePasskeyAutofillLifecycle())

        await act(async () => {
            appStateListener('active')
        })

        expect(publishLoginIdentities).not.toHaveBeenCalled()
        expect(clearLoginIdentities).not.toHaveBeenCalled()
    })

    it('leaves the OS index alone in production', async () => {
        buildFlags.isProd = true
        passwordManager.isEnabled = false
        renderHook(() => usePasskeyAutofillLifecycle())

        await act(async () => {
            appStateListener('active')
        })

        expect(publishLoginIdentities).not.toHaveBeenCalled()
        expect(clearLoginIdentities).not.toHaveBeenCalled()
    })

    it('publishes once when keys hydrate but not on later key-count changes', async () => {
        const setKeyCount = mockKeystore(0)
        renderHook(() => usePasskeyAutofillLifecycle())

        await act(async () => setKeyCount(3))
        expect(publishLoginIdentities).toHaveBeenCalledTimes(1)

        await act(async () => setKeyCount(5))
        expect(publishLoginIdentities).toHaveBeenCalledTimes(1)
        expect(reconcileKeystore).toHaveBeenCalledTimes(2)
    })

    it('clears the index when the flag flips off mid-session', async () => {
        const { rerender } = renderHook(() => usePasskeyAutofillLifecycle())
        clearLoginIdentities.mockClear()

        passwordManager.isEnabled = false
        rerender()

        expect(clearLoginIdentities).toHaveBeenCalledWith(service)
    })

    it('does not publish an empty set on launch before keys have hydrated', () => {
        renderHook(() => usePasskeyAutofillLifecycle())

        expect(publishLoginIdentities).not.toHaveBeenCalled()
    })
})
