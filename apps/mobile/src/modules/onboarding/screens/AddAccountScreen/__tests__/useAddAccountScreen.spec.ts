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

const mockCreateHdWalletAccount = vi.fn()
const mockCreateAlgo25WalletAccount = vi.fn()
const mockCreateNextHDAccount = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

const mockHasMultipleHDWallets = vi.fn(() => false)

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useCreateAccount: () => ({
            createHdWalletAccount: mockCreateHdWalletAccount,
            createAlgo25WalletAccount: mockCreateAlgo25WalletAccount,
        }),
        useAllAccounts: () => mockUseAllAccounts(),
        useCreateNextHDAccount: () => ({
            createNextHDAccount: mockCreateNextHDAccount,
            hasHDWallet: mockUseAllAccounts().some(
                (a: WalletAccount) => a.type === 'hdWallet',
            ),
        }),
        useHDWalletGroups: () => ({
            hdWalletGroups: [],
            hasMultipleHDWallets: mockHasMultipleHDWallets(),
        }),
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

const mockParseDeeplink = vi.fn()
vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        parseDeeplink: mockParseDeeplink,
        handleDeepLink: vi.fn(),
        isValidDeepLink: vi.fn(),
        buildAccountDeeplink: vi.fn(),
    }),
}))

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
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9 as const,
    },
    keyPairId: 'wallet-1',
}

describe('useAddAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    it('mainOptions excludes add account option when no HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )
        expect(addOption).toBeUndefined()
    })

    it('mainOptions includes Create Universal Wallet at top when no HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.mainOptions[0]?.testID).toBe(
            'add_account_create_universal_wallet_button',
        )
        expect(result.current.mainOptions[1]?.testID).toBe(
            'add_account_create_joint_button',
        )
        expect(result.current.mainOptions[2]?.testID).toBe(
            'add_account_import_button',
        )
    })

    it('mainOptions excludes Create Universal Wallet when HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )
        expect(universalOption).toBeUndefined()
    })

    it('mainOptions includes add account option when HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )
        expect(addOption).toBeDefined()
    })

    it('mainOptions always includes import account option', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const importOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_import_button',
        )
        expect(importOption).toBeDefined()
    })

    it('otherOptions includes watch, universal wallet, and algo25 when HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.otherOptions).toHaveLength(3)
        expect(
            result.current.otherOptions.find(
                o => o.testID === 'add_account_watch_button',
            ),
        ).toBeDefined()
        expect(
            result.current.otherOptions.find(
                o => o.testID === 'add_account_create_universal_wallet_button',
            ),
        ).toBeDefined()
        expect(
            result.current.otherOptions.find(
                o => o.testID === 'add_account_create_algo25_button',
            ),
        ).toBeDefined()
    })

    it('otherOptions excludes universal wallet when no HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.otherOptions).toHaveLength(2)
        expect(
            result.current.otherOptions.find(
                o => o.testID === 'add_account_watch_button',
            ),
        ).toBeDefined()
        expect(
            result.current.otherOptions.find(
                o => o.testID === 'add_account_create_universal_wallet_button',
            ),
        ).toBeUndefined()
        expect(
            result.current.otherOptions.find(
                o => o.testID === 'add_account_create_algo25_button',
            ),
        ).toBeDefined()
    })

    it('handleClose navigates back', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handleClose()
        })

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it('import account option navigates to ImportAccountOptions', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const importOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_import_button',
        )!

        act(() => {
            importOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('ImportAccountOptions')
    })

    it('mainOptions does not include pair ledger or scan qr options', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_pair_ledger_button',
            ),
        ).toBeUndefined()
        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_scan_qr_button',
            ),
        ).toBeUndefined()
    })

    it('mainOptions includes joint account option', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_create_joint_button',
            ),
        ).toBeDefined()
    })

    it('watch address option navigates to WatchInfo', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const watchOption = result.current.otherOptions.find(
            o => o.testID === 'add_account_watch_button',
        )!

        act(() => {
            watchOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('WatchInfo')
    })

    it('universal wallet option creates account and navigates to NameAccount', async () => {
        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        await act(async () => {
            universalOption.onPress()
        })

        expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('universal wallet option shows error toast on failure', async () => {
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        await act(async () => {
            universalOption.onPress()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('universal wallet option in otherOptions creates new wallet when HD wallet exists', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        await act(async () => {
            universalOption.onPress()
        })

        expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('algo25 option creates algo25 account and navigates to NameAccount', async () => {
        const newAccount = {
            id: 'algo25-id',
            address: 'ALGO25_ADDRESS',
            type: 'algo25' as const,
            canSign: true,
        }
        mockCreateAlgo25WalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const algo25Option = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_algo25_button',
        )!

        await act(async () => {
            algo25Option.onPress()
        })

        expect(mockCreateAlgo25WalletAccount).toHaveBeenCalledWith({})
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('algo25 option shows error toast on failure', async () => {
        mockCreateAlgo25WalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        const algo25Option = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_algo25_button',
        )!

        await act(async () => {
            algo25Option.onPress()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('add account option calls createNextHDAccount and navigates to NameAccount', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const newAccount = {
            id: 'new-hd',
            address: 'NEW_HD_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateNextHDAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockCreateNextHDAccount).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('add account option does nothing when no HD wallet accounts exist', async () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )
        expect(addOption).toBeUndefined()
        expect(mockCreateNextHDAccount).not.toHaveBeenCalled()
    })

    it('add account option shows error toast on failure', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockCreateNextHDAccount.mockRejectedValue(
            new Error('Derivation failed'),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('isCreatingAccount reflects loading state during account creation', async () => {
        let resolveCreate: (value: unknown) => void
        mockCreateHdWalletAccount.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve
                }),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.isCreatingAccount).toBe(false)

        const universalOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        // Start creation - deferToNextCycle is synchronous in tests
        // so isCreatingAccount will be set then unset
        await act(async () => {
            universalOption.onPress()
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

    it('add account navigates to SelectHDWallet when multiple HD wallets exist', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockHasMultipleHDWallets.mockReturnValue(true)

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('SelectHDWallet')
        expect(mockCreateNextHDAccount).not.toHaveBeenCalled()
    })

    it('add account does not navigate to SelectHDWallet when single HD wallet exists', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockHasMultipleHDWallets.mockReturnValue(false)

        const newAccount = {
            id: 'new-hd',
            address: 'NEW_HD_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockCreateNextHDAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockPush).not.toHaveBeenCalledWith('SelectHDWallet')
        expect(mockCreateNextHDAccount).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })
})
