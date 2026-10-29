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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAddAccountScreen } from '../useAddAccountScreen'
import {
    accountPresentationChainAdapters,
    type LocalAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { capabilityState } from '@test-utils/capability-mock'
import { registerAlgorandAccountsAdapter } from '@test-utils/algorandAccountsAdapter'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

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

const mockUseCardSession = vi.fn(() => ({ isAuthenticated: false }))
vi.mock('@perawallet/wallet-core-card', () => ({
    useCardSession: () => mockUseCardSession(),
}))

const mockPeraCardFlag = vi.hoisted(() => ({ enabled: true }))
vi.mock('@hooks/useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: () => mockPeraCardFlag.enabled,
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

const mockWatchableChainIds = vi.hoisted(() => ({
    chainIds: ['algorand'] as string[],
}))
vi.mock('@modules/onboarding/hooks', async importOriginal => ({
    ...(await importOriginal<typeof import('@modules/onboarding/hooks')>()),
    useWatchableChainIds: () => mockWatchableChainIds.chainIds,
}))

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

describe('useAddAccountScreen', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockUseCardSession.mockReturnValue({ isAuthenticated: false })
        mockPeraCardFlag.enabled = true
        setQuantumEnabled(true)
    })

    const findOption = (options: { testID: string }[], testID: string) =>
        options.find(o => o.testID === testID)

    it('mainOptions lists add account, Pera Card and import, in that order', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.mainOptions.map(o => o.testID)).toEqual([
            'add_account_add_button',
            'add_account_pera_card_button',
            'add_account_import_button',
        ])
    })

    it('mainOptions offers add account even without an HD wallet', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            findOption(result.current.mainOptions, 'add_account_add_button'),
        ).toBeDefined()
    })

    it('add account option describes the existing Universal Wallet when one exists', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.mainOptions[0]?.descriptionKey).toBe(
            'onboarding.add_account.add_account_option_description',
        )
    })

    it('add account option describes a new multichain wallet when none exists', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        expect(result.current.mainOptions[0]?.descriptionKey).toBe(
            'onboarding.add_account_options.multichain_new_wallet_description',
        )
    })

    it('add account option opens the AddAccountOptions screen', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.mainOptions[0]!.onPress()
        })

        expect(mockPush).toHaveBeenCalledWith('AddAccountOptions', {
            chainId: 'algorand',
        })
        expect(mockBuildNextHDAccount).not.toHaveBeenCalled()
    })

    it('the main menu offers no quantum or shared account row', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        const testIDs = [
            ...result.current.mainOptions,
            ...result.current.otherOptions,
        ].map(o => o.testID)
        expect(testIDs).not.toContain('add_account_create_quantum_button')
        expect(testIDs).not.toContain('add_account_create_multisig_button')
    })

    it.each([
        ['with', [HD_ACCOUNT]],
        ['without', []],
    ])(
        'otherOptions lists watch, universal wallet and algo25 %s an HD wallet',
        (_, accounts) => {
            mockUseAllAccounts.mockReturnValue(accounts)

            const { result } = renderHook(() => useAddAccountScreen())

            expect(result.current.otherOptions.map(o => o.testID)).toEqual([
                'add_account_watch_button',
                'add_account_create_universal_wallet_button',
                'add_account_create_algo25_button',
            ])
        },
    )

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

    it('universal wallet option in otherOptions creates new wallet when HD wallet exists', async () => {
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

    it('universal wallet option shows error toast on failure', async () => {
        mockBuildHdWalletAccount.mockRejectedValue(new Error('Creation failed'))

        const { result } = renderHook(() => useAddAccountScreen())

        const universalOption = result.current.otherOptions.find(
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

    it('algo25 option creates algo25 account and navigates to NameAccount', async () => {
        const newAccount = {
            id: 'algo25-id',
            chains: { algorand: { address: 'ALGO25_ADDRESS' } },
            custody: { kind: 'local', seed: null },
            canSign: true,
        }
        mockBuildSingleKeyAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useAddAccountScreen())

        const algo25Option = result.current.otherOptions.find(
            o => o.testID === 'add_account_create_algo25_button',
        )!

        await act(async () => {
            algo25Option.onPress()
        })

        expect(mockBuildSingleKeyAccount).toHaveBeenCalledWith({
            seed: null,
        })
        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('algo25 option shows error toast on failure', async () => {
        mockBuildSingleKeyAccount.mockRejectedValue(
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

    it('otherOptions excludes the watch option when the watchAccounts capability is off', () => {
        capabilityState.turnOff('watchAccounts')

        const { result } = renderHook(() => useAddAccountScreen())

        expect(
            result.current.otherOptions.some(
                o => o.testID === 'add_account_watch_button',
            ),
        ).toBe(false)
    })

    describe('watch option copy', () => {
        const watchOptionDescription = (
            options: { testID: string; descriptionKey: string }[],
        ) =>
            options.find(o => o.testID === 'add_account_watch_button')
                ?.descriptionKey

        afterEach(() => {
            mockWatchableChainIds.chainIds = ['algorand']
            restoreAlgorandOnlyChains()
        })

        it('names Algorand while only Algorand can watch accounts', () => {
            const { result } = renderHook(() => useAddAccountScreen())

            expect(watchOptionDescription(result.current.otherOptions)).toBe(
                'onboarding.add_account.watch_address_option_description',
            )
        })

        it('names no chain once Ethereum can watch accounts too', () => {
            registerEthereumChain()
            mockWatchableChainIds.chainIds = ['algorand', 'ethereum']

            const { result } = renderHook(() => useAddAccountScreen())

            expect(watchOptionDescription(result.current.otherOptions)).toBe(
                'onboarding.add_account.watch_address_option_description_generic',
            )
        })
    })

    it('offers no key-kind create row on a chain with no account presentation', () => {
        accountPresentationChainAdapters.reset()

        const { result } = renderHook(() => useAddAccountScreen())

        const testIDs = [
            ...result.current.mainOptions,
            ...result.current.otherOptions,
        ].map(o => o.testID)
        expect(testIDs).not.toContain('add_account_create_algo25_button')
        expect(testIDs).toContain('add_account_import_button')
    })

    it('creatingTitleKey stays the default while an algo25 account is created', async () => {
        let resolveCreate: (value: unknown) => void
        mockBuildSingleKeyAccount.mockImplementation(
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
            resolveCreate!({
                id: 'a',
                chains: { algorand: { address: 'ADDR' } },
            })
        })
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

        const universalOption = result.current.otherOptions.find(
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
            resolveCreate!({
                id: 'test',
                chains: { algorand: { address: 'ADDR' } },
            })
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
            url: 'https://example.com/terms?lang=en',
            id: 'terms-of-service',
        })
    })

    it('handlePrivacyPress opens privacy policy webview', () => {
        const { result } = renderHook(() => useAddAccountScreen())

        act(() => {
            result.current.handlePrivacyPress()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://example.com/privacy?lang=en',
            id: 'privacy-policy',
        })
    })
})
