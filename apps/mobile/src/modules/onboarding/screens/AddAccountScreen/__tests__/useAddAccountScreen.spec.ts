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
import { useAddAccountScreen } from '../useAddAccountScreen'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { OnboardingEvent } from '@analytics'

const mockGoBack = vi.fn()
const mockPush = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        push: mockPush,
        navigate: mockNavigate,
    }),
}))

const mockResetMultisigCreation = vi.fn()
vi.mock('@modules/multisig/hooks/useMultisigCreation', () => ({
    useMultisigCreationStore: (selector: (state: unknown) => unknown) =>
        selector({ resetState: mockResetMultisigCreation }),
}))

const mockBuildHdWalletAccount = vi.fn()
const mockBuildAlgo25WalletAccount = vi.fn()
const mockBuildQuantumWalletAccount = vi.fn()
const mockBuildNextHDAccount = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

const mockHasMultipleHDWallets = vi.fn(() => false)

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useCreateAccount: () => ({
            buildHdWalletAccount: mockBuildHdWalletAccount,
            buildAlgo25WalletAccount: mockBuildAlgo25WalletAccount,
            buildQuantumWalletAccount: mockBuildQuantumWalletAccount,
        }),
        useAllAccounts: () => mockUseAllAccounts(),
        useCreateNextHDAccount: () => ({
            buildNextHDAccount: mockBuildNextHDAccount,
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
            accountTypeSupportUrl: 'https://example.com/account-types',
            quantumAccountSupportUrl: 'https://example.com/quantum-account',
        },
        // Pinned: the real values depend on the machine-local generated env
        // and test-runner globals, and the card-session cases assert
        // signed-prod behavior.
        isDebug: false,
        isStaging: false,
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

const mockUseCardSession = vi.fn(() => ({ isAuthenticated: false }))
vi.mock('@perawallet/wallet-core-card', () => ({
    useCardSession: () => mockUseCardSession(),
}))

const mockPeraCardFlag = vi.hoisted(() => ({ enabled: true }))
vi.mock('@hooks/useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: () => mockPeraCardFlag.enabled,
}))

const mockQuantumFlag = vi.hoisted(() => ({ enabled: true }))
vi.mock('@hooks/useIsQuantumAccountsEnabled', () => ({
    useIsQuantumAccountsEnabled: () => mockQuantumFlag.enabled,
}))

const mockTrackEvent = vi.hoisted(() => vi.fn())
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

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
        mockUseCardSession.mockReturnValue({ isAuthenticated: false })
        mockPeraCardFlag.enabled = true
        mockQuantumFlag.enabled = true
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
            'add_account_create_quantum_button',
        )
        expect(result.current.mainOptions[2]?.testID).toBe(
            'add_account_create_multisig_button',
        )
        expect(result.current.mainOptions[3]?.testID).toBe(
            'add_account_pera_card_button',
        )
        expect(result.current.mainOptions[4]?.testID).toBe(
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

    it('mainOptions includes shared account option', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_create_multisig_button',
            ),
        ).toBeDefined()
    })

    it('mainOptions places pera card option between shared account and import', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const multisigIndex = result.current.mainOptions.findIndex(
            o => o.testID === 'add_account_create_multisig_button',
        )
        const peraCardIndex = result.current.mainOptions.findIndex(
            o => o.testID === 'add_account_pera_card_button',
        )
        const importIndex = result.current.mainOptions.findIndex(
            o => o.testID === 'add_account_import_button',
        )

        expect(peraCardIndex).toBe(multisigIndex + 1)
        expect(importIndex).toBe(peraCardIndex + 1)
    })

    it('pera card option navigates to the Pera Card intro screen', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const peraCardOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_pera_card_button',
        )!

        act(() => {
            peraCardOption.onPress()
        })

        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'PeraCardIntro',
        })
    })

    it('mainOptions excludes pera card option when the user has an authenticated card session', () => {
        mockUseCardSession.mockReturnValue({ isAuthenticated: true })

        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_pera_card_button',
            ),
        ).toBeUndefined()
    })

    it('mainOptions excludes pera card option when the feature flag is disabled', () => {
        mockPeraCardFlag.enabled = false

        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_pera_card_button',
            ),
        ).toBeUndefined()
    })

    it('shared account option opens introduction dialog without navigating', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const multisigOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_multisig_button',
        )!

        expect(result.current.isMultisigIntroductionVisible).toBe(false)

        act(() => {
            multisigOption.onPress()
        })

        expect(result.current.isMultisigIntroductionVisible).toBe(true)
        expect(mockResetMultisigCreation).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('closing shared account introduction hides dialog without navigating', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const multisigOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_multisig_button',
        )!

        act(() => {
            multisigOption.onPress()
        })

        act(() => {
            result.current.handleCloseMultisigIntroduction()
        })

        expect(result.current.isMultisigIntroductionVisible).toBe(false)
        expect(mockResetMultisigCreation).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('continuing shared account introduction resets state and navigates to CreateMultisig', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const multisigOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_multisig_button',
        )!

        act(() => {
            multisigOption.onPress()
        })

        act(() => {
            result.current.handleContinueMultisigIntroduction()
        })

        expect(result.current.isMultisigIntroductionVisible).toBe(false)
        expect(mockResetMultisigCreation).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledWith('Multisig', {
            screen: 'CreateMultisig',
        })
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
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        await act(async () => {
            universalOption.onPress()
        })

        expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('universal wallet option shows error toast on failure', async () => {
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        await act(async () => {
            universalOption.onPress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
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
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_universal_wallet_button',
        )!

        await act(async () => {
            universalOption.onPress()
        })

        expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
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
        mockBuildAlgo25WalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const algo25Option = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_algo25_button',
        )!

        await act(async () => {
            algo25Option.onPress()
        })

        expect(mockBuildAlgo25WalletAccount).toHaveBeenCalledWith({})
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('algo25 option shows error toast on failure', async () => {
        mockBuildAlgo25WalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        const algo25Option = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_algo25_button',
        )!

        await act(async () => {
            algo25Option.onPress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
    })

    it('mainOptions includes quantum option when the flag is enabled', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_create_quantum_button',
            ),
        ).toBeDefined()
    })

    it('mainOptions excludes quantum option when the flag is disabled', () => {
        mockQuantumFlag.enabled = false

        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.mainOptions.find(
                o => o.testID === 'add_account_create_quantum_button',
            ),
        ).toBeUndefined()
    })

    it('places the quantum option directly after the first account option', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        const addIndex = result.current.mainOptions.findIndex(
            o => o.testID === 'add_account_add_button',
        )
        const quantumIndex = result.current.mainOptions.findIndex(
            o => o.testID === 'add_account_create_quantum_button',
        )

        expect(quantumIndex).toBe(addIndex + 1)
    })

    it('quantum option carries a NEW badge and a learn-more link', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const quantumOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        expect(quantumOption.badge?.labelKey).toBe(
            'onboarding.add_account.quantum_account_option_badge',
        )
        expect(quantumOption.learnMore?.labelKey).toBe(
            'onboarding.add_account.quantum_account_option_learn_more',
        )
    })

    it('quantum learn-more link opens the quantum-account support webview', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const quantumOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        act(() => {
            quantumOption.learnMore!.onPress()
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://example.com/quantum-account',
            }),
        )
    })

    it('quantum option creates quantum account and navigates to NameAccount', async () => {
        const newAccount = {
            id: 'quantum-id',
            address: 'QUANTUM_ADDRESS',
            type: 'quantum' as const,
            canSign: true,
        }
        mockBuildQuantumWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const quantumOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(mockBuildQuantumWalletAccount).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('quantum option tracks the quantum-account press event', async () => {
        mockBuildQuantumWalletAccount.mockResolvedValue(null)

        const { result } = renderHook(() => useAddAccountScreen())

        const quantumOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.CreateAccountQuantum,
        )
    })

    it('quantum option shows error toast on failure', async () => {
        mockBuildQuantumWalletAccount.mockRejectedValue(
            new Error('Keygen failed'),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        const quantumOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
    })

    it('creatingTitleKey reflects the quantum title while a quantum account is created', async () => {
        let resolveCreate: (value: unknown) => void
        mockBuildQuantumWalletAccount.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve
                }),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        // Default title before any creation starts.
        expect(result.current.creatingTitleKey).toBe(
            'onboarding.create_account.processing',
        )

        const quantumOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(result.current.creatingTitleKey).toBe(
            'onboarding.add_account.quantum_creating_title',
        )

        await act(async () => {
            resolveCreate!({ id: 'q', address: 'ADDR' })
        })
    })

    it('creatingTitleKey stays the default while an algo25 account is created', async () => {
        let resolveCreate: (value: unknown) => void
        mockBuildAlgo25WalletAccount.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve
                }),
        )

        const { result } = renderHook(() => useAddAccountScreen())

        const algo25Option = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_algo25_button',
        )!

        await act(async () => {
            algo25Option.onPress()
        })

        expect(result.current.creatingTitleKey).toBe(
            'onboarding.create_account.processing',
        )

        await act(async () => {
            resolveCreate!({ id: 'a', address: 'ADDR' })
        })
    })

    it('add account option calls createNextHDAccount and navigates to NameAccount', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const newAccount = {
            id: 'new-hd',
            address: 'NEW_HD_ADDRESS',
            type: 'hdWallet' as const,
            canSign: true,
        }
        mockBuildNextHDAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockBuildNextHDAccount).toHaveBeenCalled()
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
        expect(mockBuildNextHDAccount).not.toHaveBeenCalled()
    })

    it('add account option shows error toast on failure', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockBuildNextHDAccount.mockRejectedValue(new Error('Derivation failed'))

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
    })

    it('isCreatingAccount reflects loading state during account creation', async () => {
        let resolveCreate: (value: unknown) => void
        mockBuildHdWalletAccount.mockImplementation(
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
        expect(mockBuildNextHDAccount).not.toHaveBeenCalled()
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
        mockBuildNextHDAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const addOption = result.current.mainOptions.find(
            o => o.testID === 'add_account_add_button',
        )!

        await act(async () => {
            addOption.onPress()
        })

        expect(mockPush).not.toHaveBeenCalledWith('SelectHDWallet')
        expect(mockBuildNextHDAccount).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })
})
