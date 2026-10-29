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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { capabilityState } from '@test-utils/capability-mock'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import { useLocalKeyCreateOptions } from '../useLocalKeyCreateOptions'

const mockBuildSingleKeyAccount = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useCreateAccount: () => ({
        buildSingleKeyAccount: mockBuildSingleKeyAccount,
    }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))

const mockRunCreateAccount = vi.fn()

const render = (isCreatingAccount = false) =>
    renderHook(() =>
        useLocalKeyCreateOptions({
            chainId: 'algorand',
            runCreateAccount: mockRunCreateAccount,
            isCreatingAccount,
        }),
    )

describe('useLocalKeyCreateOptions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandAccountsAdapter()
        capabilityState.reset()
    })

    it('features quantum and leaves algo25 for the other options', () => {
        const { result } = render()

        expect(result.current.featured.map(o => o.testID)).toEqual([
            'add_account_create_quantum_button',
        ])
        expect(result.current.other.map(o => o.testID)).toEqual([
            'add_account_create_algo25_button',
        ])
    })

    it('drops quantum while quantum accounts are off', () => {
        capabilityState.turnOff('quantumAccounts')

        const { result } = render()

        expect(result.current.featured).toEqual([])
    })

    it('disables every row while an account is being created', () => {
        const { result } = render(true)

        expect(
            [...result.current.featured, ...result.current.other].every(
                o => o.isDisabled,
            ),
        ).toBe(true)
    })

    it('creates the kind with its own progress title', () => {
        const { result } = render()

        act(() => {
            result.current.featured[0]!.onPress()
        })

        expect(mockRunCreateAccount).toHaveBeenCalledWith(
            expect.any(Function),
            'onboarding.add_account.quantum_creating_title',
        )
    })

    it('opens the learn-more page in a webview', () => {
        const { result } = render()

        act(() => {
            result.current.featured[0]!.learnMore!.onPress()
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'quantum-account-support' }),
        )
    })
})
