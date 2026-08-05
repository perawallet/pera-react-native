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

import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockBuildHd = vi.fn()
const mockBuildNext = vi.fn()
let mockHasHDWallet = false
let mockHasMultipleHDWallets = false

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useCreateAccount: () => ({ buildHdWalletAccount: mockBuildHd }),
    useCreateNextHDAccount: () => ({
        buildNextHDAccount: mockBuildNext,
        hasHDWallet: mockHasHDWallet,
    }),
    useHDWalletGroups: () => ({
        hasMultipleHDWallets: mockHasMultipleHDWallets,
    }),
}))

// `@routes/navigationRef` is resolved eagerly, so the mock factory runs before
// the test body — declare the spies via vi.hoisted so they're initialized in time.
const mockDispatch = vi.hoisted(() => vi.fn())
vi.mock('@routes/navigationRef', () => ({
    navigationRef: { dispatch: mockDispatch },
}))

// Tag the push action so we can assert what was dispatched without coupling to
// React Navigation's internal action shape.
const mockPush = vi.hoisted(() =>
    vi.fn((name: string, params: unknown) => ({ kind: 'push', name, params })),
)
vi.mock('@react-navigation/native', () => ({
    StackActions: { push: mockPush },
}))

const mockErrorToast = vi.fn()
const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({
        showError: mockShowError,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useCardAddAccount } from '../useCardAddAccount'

const RETURN_TO = {
    name: 'PeraCard',
    params: {
        screen: 'CardOnboarding',
        params: {
            screen: 'CardOnboardingStatus',
            params: { autoConnectSelected: true },
        },
    },
}

const NEW_ACCOUNT = { address: 'NEW', type: 'hdWallet' } as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    mockHasHDWallet = false
    mockHasMultipleHDWallets = false
    mockBuildHd.mockResolvedValue(NEW_ACCOUNT)
    mockBuildNext.mockResolvedValue(NEW_ACCOUNT)
})

describe('useCardAddAccount', () => {
    it('lets the user pick a wallet when there are multiple HD wallets', async () => {
        mockHasHDWallet = true
        mockHasMultipleHDWallets = true
        const { result } = renderHook(() => useCardAddAccount())

        act(() => result.current.handleCreateAccount())

        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith('AddAccount', {
                screen: 'SelectHDWallet',
                params: { returnTo: RETURN_TO },
            }),
        )
        // Pushed (not navigated) so PeraCard stays beneath for the returnTo.
        expect(mockDispatch).toHaveBeenCalledWith(
            mockPush.mock.results[0].value,
        )
        expect(mockBuildNext).not.toHaveBeenCalled()
    })

    it('builds the next account and goes straight to NameAccount for a single HD wallet', async () => {
        mockHasHDWallet = true
        const { result } = renderHook(() => useCardAddAccount())

        act(() => result.current.handleCreateAccount())

        await waitFor(() => expect(mockBuildNext).toHaveBeenCalled())
        // The push is deferred a frame past the sheet teardown, so it lands
        // after the build resolves rather than in the same tick.
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith('AddAccount', {
                screen: 'NameAccount',
                params: { account: NEW_ACCOUNT, returnTo: RETURN_TO },
            }),
        )
    })

    it('creates a universal wallet then names it when there is no HD wallet', async () => {
        mockHasHDWallet = false
        const { result } = renderHook(() => useCardAddAccount())

        act(() => result.current.handleCreateAccount())

        await waitFor(() =>
            expect(mockBuildHd).toHaveBeenCalledWith({
                account: 0,
                keyIndex: 0,
            }),
        )
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith('AddAccount', {
                screen: 'NameAccount',
                params: { account: NEW_ACCOUNT, returnTo: RETURN_TO },
            }),
        )
    })

    it('falls back to the wallet picker when the build returns null', async () => {
        mockHasHDWallet = true
        mockBuildNext.mockResolvedValue(null)
        const { result } = renderHook(() => useCardAddAccount())

        act(() => result.current.handleCreateAccount())

        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith('AddAccount', {
                screen: 'SelectHDWallet',
                params: { returnTo: RETURN_TO },
            }),
        )
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('shows an error toast when account creation throws', async () => {
        mockHasHDWallet = true
        mockBuildNext.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() => useCardAddAccount())

        act(() => result.current.handleCreateAccount())

        await waitFor(() =>
            expect(mockShowError).toHaveBeenCalledWith(
                expect.any(Error),
                'onboarding.create_account.error_title',
            ),
        )
        expect(mockPush).not.toHaveBeenCalled()
    })
})
