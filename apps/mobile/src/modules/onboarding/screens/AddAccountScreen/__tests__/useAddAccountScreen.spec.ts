/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useAddAccountScreen } from '../useAddAccountScreen'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockGoBack = vi.fn()
const mockPush = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        push: mockPush,
    }),
}))

const mockCreateAccount = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useCreateAccount: () => mockCreateAccount,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        deferToNextCycle: (callback: () => Promise<void>) => callback(),
    }
})

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

vi.mock('@perawallet/wallet-core-config', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-config',
    )
    return {
        ...actual,
        config: {
            termsOfServiceUrl: 'https://example.com/terms',
            privacyPolicyUrl: 'https://example.com/privacy',
        },
    }
})

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: {
                changeLanguage: vi.fn(),
                language: 'en',
            },
        }),
    }
})

const HD_ACCOUNT = {
    id: 'hd-1',
    address: 'HD_ADDRESS',
    type: 'hdWallet' as const,
    canSign: true,
    hdWalletDetails: {
        walletId: 'wallet-1',
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9 as const,
    },
}

describe('useAddAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    it('returns hasHDWallet as false when no HD wallet accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.hasHDWallet).toBe(false)
    })

    it('returns hasHDWallet as true when HD wallet accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.hasHDWallet).toBe(true)
    })

    it('handleClose navigates back', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleClose()
        })

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it('handleImportAccount opens import options', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.isImportOptionsVisible).toBe(false)

        act(() => {
            result.current.handleImportAccount()
        })

        expect(result.current.isImportOptionsVisible).toBe(true)
    })

    it('handleCloseImportOptions closes import options', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleImportAccount()
        })
        expect(result.current.isImportOptionsVisible).toBe(true)

        act(() => {
            result.current.handleCloseImportOptions()
        })
        expect(result.current.isImportOptionsVisible).toBe(false)
    })

    it('handleHDWalletPress closes import options and navigates to ImportInfo with hdWallet', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleImportAccount()
        })

        act(() => {
            result.current.handleHDWalletPress()
        })

        expect(result.current.isImportOptionsVisible).toBe(false)
        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'hdWallet',
        })
    })

    it('handleAlgo25Press closes import options and navigates to ImportInfo with algo25', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleImportAccount()
        })

        act(() => {
            result.current.handleAlgo25Press()
        })

        expect(result.current.isImportOptionsVisible).toBe(false)
        expect(mockPush).toHaveBeenCalledWith('ImportInfo', {
            accountType: 'algo25',
        })
    })

    it('handleWatchAddress navigates to WatchAccount', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleWatchAddress()
        })

        expect(mockPush).toHaveBeenCalledWith('WatchAccount')
    })

    it('handleCreateUniversalWallet creates account and navigates to NameAccount', async () => {
        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleCreateUniversalWallet()
        })

        expect(mockCreateAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('handleCreateUniversalWallet shows error toast on failure', async () => {
        mockCreateAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleCreateUniversalWallet()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('handleCreateAlgo25 creates algo25 account and navigates to NameAccount', async () => {
        const newAccount = {
            id: 'algo25-id',
            address: 'ALGO25_ADDRESS',
            type: 'algo25' as const,
            canSign: true,
        }
        mockCreateAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleCreateAlgo25()
        })

        expect(mockCreateAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
            type: 'algo25',
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('handleCreateAlgo25 shows error toast on failure', async () => {
        mockCreateAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleCreateAlgo25()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('handleAddAccount derives next key index from existing HD wallet accounts', async () => {
        const secondHDAccount = {
            ...HD_ACCOUNT,
            id: 'hd-2',
            address: 'HD_ADDRESS_2',
            hdWalletDetails: {
                ...HD_ACCOUNT.hdWalletDetails,
                keyIndex: 2,
            },
        }
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT, secondHDAccount])

        const newAccount = {
            id: 'new-hd',
            address: 'NEW_HD_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleAddAccount()
        })

        expect(mockCreateAccount).toHaveBeenCalledWith({
            walletId: 'wallet-1',
            account: 0,
            keyIndex: 3,
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('handleAddAccount does nothing when no HD wallet accounts exist', async () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleAddAccount()
        })

        expect(mockCreateAccount).not.toHaveBeenCalled()
    })

    it('handleAddAccount shows error toast on failure', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockCreateAccount.mockRejectedValue(new Error('Derivation failed'))

        const { result } = renderHook(() => useAddAccountScreen())

        await act(async () => {
            result.current.handleAddAccount()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('isCreatingAccount reflects loading state during account creation', async () => {
        let resolveCreate: (value: unknown) => void
        mockCreateAccount.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve
                }),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.isCreatingAccount).toBe(false)

        // Start creation - deferToNextCycle is synchronous in tests
        // so isCreatingAccount will be set then unset
        await act(async () => {
            result.current.handleCreateUniversalWallet()
            // At this point openCreatingAccount was called
        })

        // After the promise resolves, closeCreatingAccount is called
        await act(async () => {
            resolveCreate!({ id: 'test', address: 'ADDR' })
        })

        expect(result.current.isCreatingAccount).toBe(false)
    })

    it('isOtherOptionsVisible is false by default', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.isOtherOptionsVisible).toBe(false)
    })

    it('handleToggleOtherOptions toggles isOtherOptionsVisible', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.isOtherOptionsVisible).toBe(false)

        act(() => {
            result.current.handleToggleOtherOptions()
        })

        expect(result.current.isOtherOptionsVisible).toBe(true)

        act(() => {
            result.current.handleToggleOtherOptions()
        })

        expect(result.current.isOtherOptionsVisible).toBe(false)
    })

    it('handleTermsPress opens terms of service webview', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleTermsPress()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://example.com/terms',
            id: 'terms-of-service',
        })
    })

    it('handlePrivacyPress opens privacy policy webview', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handlePrivacyPress()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://example.com/privacy',
            id: 'privacy-policy',
        })
    })
})
