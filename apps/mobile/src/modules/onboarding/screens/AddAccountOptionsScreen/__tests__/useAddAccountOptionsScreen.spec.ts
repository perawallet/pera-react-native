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
import type { AccountOption } from '@modules/onboarding/types'
import { useAddAccountOptionsScreen } from '../useAddAccountOptionsScreen'
import {
    accountPresentationChainAdapters,
    type LocalAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AnalyticsMetadataKey, OnboardingEvent } from '@analytics'
import { capabilityState } from '@test-utils/capability-mock'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'

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

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<object>()),
    useRoute: () => ({ params: { chainId: 'algorand' } }),
}))

const mockResetMultisigCreation = vi.fn()
vi.mock('@modules/multisig/hooks/useMultisigCreation', () => ({
    useMultisigCreationStore: (selector: (state: unknown) => unknown) =>
        selector({ resetState: mockResetMultisigCreation }),
}))

const mockBuildHdWalletAccount = vi.fn()
const mockBuildSingleKeyAccount = vi.fn()
const mockBuildNextHDAccount = vi.fn()
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

const mockHasMultipleHdSeeds = vi.fn(() => false)

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useCreateAccount: () => ({
            buildHdWalletAccount: mockBuildHdWalletAccount,
            buildSingleKeyAccount: mockBuildSingleKeyAccount,
        }),
        useAllAccounts: () => mockUseAllAccounts(),
        useCreateNextHDAccount: () => ({
            buildNextHDAccount: mockBuildNextHDAccount,
            hasHDWallet: mockUseAllAccounts().some(
                (a: WalletAccount) =>
                    a.custody.kind === 'local' && a.custody.seed === 'bip39',
            ),
        }),
        useHdSeedGroups: () => ({
            hdSeedGroups: [],
            hasMultipleHdSeeds: mockHasMultipleHdSeeds(),
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
    withLanguageParam: (url: string, locale: string) => `${url}?lang=${locale}`,
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

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

const setQuantumEnabled = (isEnabled: boolean): void => {
    capabilityState.reset()
    if (!isEnabled) {
        capabilityState.turnOff('quantumAccounts')
    }
}

const mockTrackEvent = vi.hoisted(() => vi.fn())
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

const HD_ACCOUNT: LocalAccount = {
    id: 'hd-1',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: 'HD_ADDRESS', keyPairId: 'wallet-1' } },
}

describe('useAddAccountOptionsScreen', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockHasMultipleHdSeeds.mockReturnValue(false)
        setQuantumEnabled(true)
    })

    const multichainOption = (options: AccountOption[]) =>
        options.find(o => o.testID === 'add_account_options_multichain_button')

    it('lists multichain, quantum and shared account, in that order', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        expect(result.current.options.map(o => o.testID)).toEqual([
            'add_account_options_multichain_button',
            'add_account_create_quantum_button',
            'add_account_create_multisig_button',
        ])
    })

    it('multichain option derives from the existing recovery phrase when an HD wallet exists', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        expect(result.current.options[0]?.descriptionKey).toBe(
            'onboarding.add_account_options.multichain_description',
        )
    })

    it('multichain option creates the next HD account and navigates to NameAccount', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        const newAccount = {
            id: 'new-id',
            chains: { algorand: { address: 'NEW_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            canSign: true,
        }
        mockBuildNextHDAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        await act(async () => {
            multichainOption(result.current.options)!.onPress()
        })

        expect(mockBuildNextHDAccount).toHaveBeenCalled()
        expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('multichain option navigates to SelectHDWallet when multiple HD wallets exist', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockHasMultipleHdSeeds.mockReturnValue(true)

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        await act(async () => {
            multichainOption(result.current.options)!.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('SelectHDWallet')
        expect(mockBuildNextHDAccount).not.toHaveBeenCalled()
    })

    it('multichain option shows error toast on failure', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockBuildNextHDAccount.mockRejectedValue(new Error('Derivation failed'))

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        await act(async () => {
            multichainOption(result.current.options)!.onPress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'onboarding.create_account.error_title',
        )
    })

    it('multichain option starts a new Universal Wallet when no HD wallet exists', async () => {
        const newAccount = {
            id: 'new-id',
            chains: { algorand: { address: 'NEW_ADDRESS' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            canSign: true,
        }
        mockBuildHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        expect(multichainOption(result.current.options)?.descriptionKey).toBe(
            'onboarding.add_account_options.multichain_new_wallet_description',
        )

        await act(async () => {
            multichainOption(result.current.options)!.onPress()
        })

        expect(mockBuildHdWalletAccount).toHaveBeenCalledWith({
            account: 0,
            keyIndex: 0,
        })
        expect(mockBuildNextHDAccount).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('disables the multichain option while an account is being created', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockBuildNextHDAccount.mockImplementation(() => new Promise(() => {}))

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        await act(async () => {
            multichainOption(result.current.options)!.onPress()
        })

        expect(result.current.isCreatingAccount).toBe(true)
        expect(multichainOption(result.current.options)).toMatchObject({
            isDisabled: true,
        })
    })

    it('quantum option carries a NEW badge and a learn-more link', () => {
        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const quantumOption = result.current.options.find(
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
        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const quantumOption = result.current.options.find(
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
            chains: { algorand: { address: 'QUANTUM_ADDRESS' } },
            custody: { kind: 'local', seed: 'quantum' },
            canSign: true,
        }
        mockBuildSingleKeyAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const quantumOption = result.current.options.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(mockBuildSingleKeyAccount).toHaveBeenCalledWith({
            seed: 'quantum',
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('quantum option tracks the quantum-account press event', async () => {
        mockBuildSingleKeyAccount.mockResolvedValue(null)

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const quantumOption = result.current.options.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.CreateAccountQuantum,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
    })

    it('quantum option shows error toast on failure', async () => {
        mockBuildSingleKeyAccount.mockRejectedValue(new Error('Keygen failed'))

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const quantumOption = result.current.options.find(
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
        mockBuildSingleKeyAccount.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveCreate = resolve
                }),
        )

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        // Default title before any creation starts.
        expect(result.current.creatingTitleKey).toBe(
            'onboarding.create_account.processing',
        )

        const quantumOption = result.current.options.find(
            o => o.testID === 'add_account_create_quantum_button',
        )!

        await act(async () => {
            quantumOption.onPress()
        })

        expect(result.current.creatingTitleKey).toBe(
            'onboarding.add_account.quantum_creating_title',
        )

        await act(async () => {
            resolveCreate!({
                id: 'q',
                chains: { algorand: { address: 'ADDR' } },
            })
        })
    })

    it('excludes quantum option when the flag is disabled', () => {
        setQuantumEnabled(false)

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        expect(
            result.current.options.find(
                o => o.testID === 'add_account_create_quantum_button',
            ),
        ).toBeUndefined()
    })

    it('excludes the multisig option when the multisig capability is off', () => {
        capabilityState.turnOff('multisig')

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        expect(
            result.current.options.some(
                o => o.testID === 'add_account_create_multisig_button',
            ),
        ).toBe(false)
    })

    it('shared account option opens introduction dialog without navigating', () => {
        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const multisigOption = result.current.options.find(
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
        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const multisigOption = result.current.options.find(
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
        const { result } = renderHook(() => useAddAccountOptionsScreen())

        const multisigOption = result.current.options.find(
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
            params: { chainId: 'algorand' },
        })
    })

    it('offers no quantum row on a chain with no account presentation', () => {
        accountPresentationChainAdapters.reset()

        const { result } = renderHook(() => useAddAccountOptionsScreen())

        expect(result.current.options.map(o => o.testID)).not.toContain(
            'add_account_create_quantum_button',
        )
    })
})
