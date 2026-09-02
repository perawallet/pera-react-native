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

const { getKeystoreStore, getProvider, reconcileKeystore } = vi.hoisted(
    () => ({
        getKeystoreStore: vi.fn(),
        getProvider: vi.fn(),
        reconcileKeystore: vi.fn(async () => ({ failedIds: [] })),
    }),
)
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore,
    getProvider,
    reconcileKeystore,
}))

const { publishLoginIdentities } = vi.hoisted(() => ({
    publishLoginIdentities: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-passwords', () => ({
    publishLoginIdentities,
}))

import { usePasskeyAutofillLifecycle } from '../passkey-autofill'

describe('usePasskeyAutofillLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getProvider.mockReturnValue({ passkeyAutofill: service })
        getKeystoreStore.mockReturnValue({
            state: { keys: [] },
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        })
    })

    it('republishes password identities when the lifecycle refreshes', async () => {
        renderHook(() => usePasskeyAutofillLifecycle())

        await act(async () => {
            appStateListener('active')
        })

        expect(publishLoginIdentities).toHaveBeenCalled()
    })
})
