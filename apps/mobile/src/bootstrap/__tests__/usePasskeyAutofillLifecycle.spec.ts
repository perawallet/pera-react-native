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

import { AppState } from 'react-native'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    invalidateQueries: vi.fn(async () => {}),
    reconcileKeystore: vi.fn(async () => ({ failedIds: [] as string[] })),
    onPasskeyAuthenticated: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    bootstrapPasskeyAutofill: vi.fn(async () => {}),
    passkeysQueryKeyRoot: ['passkeys'],
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: { capabilities: () => ({ liquidAuth: false }) },
        passkeyAutofill: {
            onPasskeyAdded: () => ({ remove: vi.fn() }),
            onPasskeyAuthenticated: mocks.onPasskeyAuthenticated,
        },
    }),
    getKeystoreStore: () => ({
        state: { keys: [] },
        subscribe: () => ({ unsubscribe: vi.fn() }),
    }),
    reconcileKeystore: mocks.reconcileKeystore,
}))

vi.mock('@providers/queryClient', () => ({
    queryClient: { invalidateQueries: mocks.invalidateQueries },
}))

import { usePasskeyAutofillLifecycle } from '../passkey-autofill'

describe('usePasskeyAutofillLifecycle', () => {
    let appStateListener: ((state: string) => void) | undefined

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.onPasskeyAuthenticated.mockReturnValue({ remove: vi.fn() })
        vi.spyOn(AppState, 'addEventListener').mockImplementation(
            (_event, handler) => {
                appStateListener = handler as (state: string) => void
                return { remove: vi.fn() } as ReturnType<
                    typeof AppState.addEventListener
                >
            },
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('refetches the passkey list when the app returns to the foreground', () => {
        renderHook(() => usePasskeyAutofillLifecycle())

        appStateListener?.('active')

        expect(mocks.reconcileKeystore).toHaveBeenCalledTimes(1)
        expect(mocks.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['passkeys'],
        })
    })

    it('refetches the passkey list when the native side reports a sign-in', () => {
        renderHook(() => usePasskeyAutofillLifecycle())
        const onAuthenticated = mocks.onPasskeyAuthenticated.mock
            .calls[0]?.[0] as () => void

        onAuthenticated()

        expect(mocks.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['passkeys'],
        })
    })

    it('leaves the passkey list alone when the app goes to the background', () => {
        renderHook(() => usePasskeyAutofillLifecycle())

        appStateListener?.('background')

        expect(mocks.invalidateQueries).not.toHaveBeenCalled()
    })
})
