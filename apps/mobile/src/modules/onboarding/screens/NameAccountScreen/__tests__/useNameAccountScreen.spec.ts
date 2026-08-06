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
import type { Optional } from '@perawallet/wallet-core-shared'
import { useNameAccountScreen } from '../useNameAccountScreen'

const mockBuildHdWalletAccount = vi.fn()
const mockSaveAccount = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockSetShouldPlayConfetti = vi.fn()
const mockExitAccountFlow = vi.fn()
const mockShowToast = vi.fn()
const mockUpdateAccount = vi.fn()

let mockRouteParams: Optional<{ account?: unknown; returnTo?: unknown }>

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: vi.fn(),
        replace: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    useCreateAccount: () => ({
        buildHdWalletAccount: mockBuildHdWalletAccount,
        saveAccount: mockSaveAccount,
    }),
    useUpdateAccount: () => mockUpdateAccount,
    consumePendingAccountRollback: vi.fn(),
    clearPendingAccountRollback: vi.fn(),
    useAccountsStore: Object.assign(
        vi.fn(() => ({})),
        {
            getState: vi.fn(() => ({ accounts: [] })),
        },
    ),
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: null,
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    getAccountDisplayName: (account: { name?: string }) =>
        account?.name ?? 'Account 1',
    isHDWalletAccount: () => false,
    isWatchAccount: (account: { type: string }) => account?.type === 'watch',
    WalletAccount: {} as unknown,
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({
        showError: mockShowError,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useShouldPlayConfetti: () => ({
        shouldPlayConfetti: false,
        setShouldPlayConfetti: mockSetShouldPlayConfetti,
    }),
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, opts?: Record<string, unknown>) => {
                if (
                    key === 'onboarding.name_account.wallet_label' &&
                    opts?.count
                ) {
                    return `Wallet ${opts.count}`
                }
                return key
            },
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

describe('useNameAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams = undefined
    })

    it('initializes with default wallet name when no account is passed', () => {
        const { result } = renderHook(() => useNameAccountScreen())

        expect(result.current.walletDisplay).toBe('Wallet 1')
        expect(result.current.account).toBeUndefined()
        expect(result.current.isCreating).toBe(false)
    })

    it('initializes with account display name when account is passed', () => {
        mockRouteParams = {
            account: {
                id: '1',
                address: 'ADDR',
                type: 'hdWallet',
                name: 'My Wallet',
                keyPairId: 'kp1',
            },
        }

        const { result } = renderHook(() => useNameAccountScreen())

        expect(result.current.walletDisplay).toBe('My Wallet')
        expect(result.current.account).toBeDefined()
    })

    it('handleNameChange updates walletDisplay', () => {
        const { result } = renderHook(() => useNameAccountScreen())

        act(() => {
            result.current.handleNameChange('New Name')
        })

        expect(result.current.walletDisplay).toBe('New Name')
    })

    it('handleFinish updates account name and exits when account is provided', async () => {
        const account = {
            id: '1',
            address: 'ADDR',
            type: 'hdWallet',
            name: 'Old Name',
            keyPairId: 'kp1',
        }
        mockRouteParams = { account }

        const { result } = renderHook(() => useNameAccountScreen())

        act(() => {
            result.current.handleNameChange('Renamed')
        })

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockSaveAccount).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Renamed', address: 'ADDR' }),
        )
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith('ADDR')
        expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
    })

    it('handleFinish forwards a returnTo target to the exit flow', async () => {
        const returnTo = {
            name: 'PeraCard',
            params: {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingStatus' },
            },
        }
        mockRouteParams = {
            account: {
                id: '1',
                address: 'ADDR',
                type: 'hdWallet',
                name: 'Old Name',
                keyPairId: 'kp1',
            },
            returnTo,
        }

        const { result } = renderHook(() => useNameAccountScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockExitAccountFlow).toHaveBeenCalledWith(returnTo)
    })

    it('handleFinish creates HD wallet account when no account is provided', async () => {
        mockBuildHdWalletAccount.mockResolvedValue({
            address: 'NEW_ADDR',
            type: 'hdWallet',
        })

        const { result } = renderHook(() => useNameAccountScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
        expect(mockSaveAccount).toHaveBeenCalledWith(
            expect.objectContaining({ address: 'NEW_ADDR' }),
        )
        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith('NEW_ADDR')
        expect(mockExitAccountFlow).toHaveBeenCalled()
    })

    it('handleFinish shows error toast on failure', async () => {
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useNameAccountScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
        expect(mockExitAccountFlow).not.toHaveBeenCalled()
        expect(result.current.isCreating).toBe(false)
    })

    it('handleFinish resets isCreating after completion', async () => {
        mockBuildHdWalletAccount.mockResolvedValue({
            address: 'ADDR',
            type: 'hdWallet',
        })

        const { result } = renderHook(() => useNameAccountScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(result.current.isCreating).toBe(false)
    })
})
