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
import { AnalyticsMetadataKey, OnboardingEvent } from '@analytics'
import { useNameAccountScreen } from '../useNameAccountScreen'

const mockBuildHdWalletAccount = vi.fn()
const mockSaveAccount = vi.fn()
const mockSetSelectedAccountId = vi.fn()
const mockSetShouldPlayConfetti = vi.fn()
const mockExitAccountFlow = vi.fn()
const mockShowToast = vi.fn()
const mockUpdateAccount = vi.fn()
const mockTrackEvent = vi.hoisted(() => vi.fn())

let mockRouteParams: Optional<{
    account?: unknown
    returnTo?: unknown
    chainId?: string
}>
const mockStoredAccounts = vi.hoisted(() => ({ accounts: [] as unknown[] }))
const mockRegisteredChainIds = vi.hoisted(() => ({
    chainIds: ['algorand'] as string[],
}))
const mockGetAccountDisplayName = vi.hoisted(() =>
    vi.fn(
        (account: { name?: string }, _chainId: string) =>
            account?.name ?? 'Account 1',
    ),
)

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
    }
})

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: vi.fn(),
        replace: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockStoredAccounts.accounts,
    useRegisteredChainIds: () => mockRegisteredChainIds.chainIds,
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
            getState: vi.fn(() => ({
                accounts: mockStoredAccounts.accounts,
            })),
        },
    ),
    useSelectedAccountId: () => ({
        selectedAccountId: null,
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
    getAccountDisplayName: mockGetAccountDisplayName,
    isNamedAfterOwnAddress: () => false,
    accountNumberOf: (account: {
        custody?: {
            kind: string
            seed?: string | null
            hd?: { account: number; keyIndex: number }
            accountIndex?: number
        }
    }) => {
        const custody = account.custody
        if (custody?.kind === 'local' && custody.hd) {
            return custody.hd.account + custody.hd.keyIndex + 1
        }
        return custody?.kind === 'hardware'
            ? (custody.accountIndex ?? 0) + 1
            : undefined
    },
    hdIndexOf: () => undefined,
    signingKeyOn: () => undefined,
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        chainId: string,
    ) => account.chains[chainId],
    findAccountByAddressOn: () => undefined,
    preferDefaultChain: (chainIds: string[]) => chainIds[0],
    isWatchAccount: (account: { custody?: { kind: string } }) =>
        account?.custody?.kind === 'watch',
    isHardwareWalletAccount: (account: { custody?: { kind: string } }) =>
        account?.custody?.kind === 'hardware',
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
        mockStoredAccounts.accounts = []
        mockRegisteredChainIds.chainIds = ['algorand']
    })

    describe('with several chains registered', () => {
        const routeAccount = {
            id: 'imported',
            chains: { algorand: { address: 'ADDR', keyPairId: 'kp' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        }
        const storedAccount = {
            ...routeAccount,
            chains: {
                ...routeAccount.chains,
                ethereum: { address: '0xabc', keyPairId: 'kp-evm' },
            },
        }

        beforeEach(() => {
            mockRegisteredChainIds.chainIds = ['algorand', 'ethereum', 'base']
        })

        it("lists the stored account's chains, including one added after it was handed over", () => {
            mockStoredAccounts.accounts = [storedAccount]
            mockRouteParams = { account: routeAccount }

            const { result } = renderHook(() => useNameAccountScreen())

            expect(result.current.enabledChainIds).toEqual([
                'algorand',
                'ethereum',
            ])
        })

        it("lists the handed-over account's chains before it is stored", () => {
            mockRouteParams = { account: routeAccount }

            const { result } = renderHook(() => useNameAccountScreen())

            expect(result.current.enabledChainIds).toEqual(['algorand'])
        })

        it('renames the stored account, keeping chains the handed-over copy lacks', async () => {
            mockStoredAccounts.accounts = [storedAccount]
            mockRouteParams = { account: routeAccount }
            const { result } = renderHook(() => useNameAccountScreen())

            act(() => {
                result.current.handleNameChange('Named')
            })
            await act(async () => {
                await result.current.handleFinish()
            })

            expect(mockUpdateAccount).toHaveBeenCalledWith({
                ...storedAccount,
                name: 'Named',
            })
            expect(mockSaveAccount).not.toHaveBeenCalled()
        })
    })

    it('lists no chains with a single chain registered', () => {
        mockRouteParams = {
            account: {
                id: '1',
                chains: { algorand: { address: 'ADDR', keyPairId: 'kp1' } },
                custody: { kind: 'watch' },
            },
        }

        const { result } = renderHook(() => useNameAccountScreen())

        expect(result.current.enabledChainIds).toEqual([])
    })

    describe('on another chain', () => {
        const CHAIN_ID = 'second-chain'
        const account = {
            id: 'chain-1',
            chains: { [CHAIN_ID]: { address: '0xabc', keyPairId: 'kp' } },
            custody: { kind: 'local', seed: null },
        }

        it("names the account from that chain's address", () => {
            mockRouteParams = { account, chainId: CHAIN_ID }

            renderHook(() => useNameAccountScreen())

            expect(mockGetAccountDisplayName).toHaveBeenCalledWith(
                account,
                CHAIN_ID,
            )
        })

        it("names the account from a chain it holds when the given chain isn't one of them", () => {
            mockRouteParams = { account, chainId: 'dropped-chain' }

            const { result } = renderHook(() => useNameAccountScreen())

            expect(mockGetAccountDisplayName).toHaveBeenCalledWith(
                account,
                CHAIN_ID,
            )
            expect(result.current.chainId).toBe(CHAIN_ID)
        })

        it('updates an account already stored under its id instead of adding it again', async () => {
            mockStoredAccounts.accounts = [account]
            mockRouteParams = { account, chainId: CHAIN_ID }
            const { result } = renderHook(() => useNameAccountScreen())

            act(() => {
                result.current.handleNameChange('Named')
            })
            await act(async () => {
                await result.current.handleFinish()
            })

            expect(mockUpdateAccount).toHaveBeenCalledWith({
                ...account,
                name: 'Named',
            })
            expect(mockSaveAccount).not.toHaveBeenCalled()
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('chain-1')
        })
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
                chains: { algorand: { address: 'ADDR', keyPairId: 'kp1' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                name: 'My Wallet',
            },
        }

        const { result } = renderHook(() => useNameAccountScreen())

        expect(result.current.walletDisplay).toBe('My Wallet')
        expect(result.current.account).toBeDefined()
    })

    describe('pre-filled name', () => {
        it.each([
            [
                'a Universal Wallet account',
                {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            ],
            [
                'a Ledger account',
                {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'device-1',
                        deviceName: 'Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
            ],
        ])('numbers %s', (_, custody) => {
            mockRouteParams = {
                account: {
                    id: 'numbered',
                    chains: { algorand: { address: 'ADDR', keyPairId: 'kp' } },
                    custody,
                },
            }

            const { result } = renderHook(() => useNameAccountScreen())

            expect(result.current.walletDisplay).toBe(
                'account_info.account_number',
            )
            expect(result.current.accountTitle).toBe(
                'account_info.account_number',
            )
        })

        it.each([
            ['an Algo25 account', { kind: 'local', seed: null }],
            ['a watch account', { kind: 'watch' }],
        ])('falls back to the address-based name for %s', (_, custody) => {
            const account = {
                id: 'unnumbered',
                chains: { algorand: { address: 'ADDR' } },
                custody,
            }
            mockRouteParams = { account }

            const { result } = renderHook(() => useNameAccountScreen())

            expect(mockGetAccountDisplayName).toHaveBeenCalledWith(
                account,
                'algorand',
            )
            expect(result.current.walletDisplay).toBe('Account 1')
        })

        it('saves no name when the numbered name is left unchanged', async () => {
            mockRouteParams = {
                account: {
                    id: 'numbered',
                    chains: { algorand: { address: 'ADDR', keyPairId: 'kp' } },
                    custody: {
                        kind: 'local',
                        seed: 'bip39',
                        hd: { account: 1, keyIndex: 0 },
                    },
                },
            }
            const { result } = renderHook(() => useNameAccountScreen())

            await act(async () => {
                await result.current.handleFinish()
            })

            expect(mockSaveAccount).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'numbered', name: undefined }),
            )
        })

        it('saves the numbered name once the user edits it', async () => {
            mockRouteParams = {
                account: {
                    id: 'numbered',
                    chains: { algorand: { address: 'ADDR', keyPairId: 'kp' } },
                    custody: {
                        kind: 'local',
                        seed: 'bip39',
                        hd: { account: 1, keyIndex: 0 },
                    },
                },
            }
            const { result } = renderHook(() => useNameAccountScreen())

            act(() => {
                result.current.handleNameChange('Savings')
            })
            await act(async () => {
                await result.current.handleFinish()
            })

            expect(mockSaveAccount).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'numbered', name: 'Savings' }),
            )
        })

        it('offers a wallet name when no account is handed over', () => {
            const { result } = renderHook(() => useNameAccountScreen())

            expect(result.current.accountTitle).toBe('Wallet 1')
        })
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
            chains: { algorand: { address: 'ADDR', keyPairId: 'kp1' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            name: 'Old Name',
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
            expect.objectContaining({
                name: 'Renamed',
                chains: { algorand: { address: 'ADDR', keyPairId: 'kp1' } },
            }),
        )
        expect(mockSetSelectedAccountId).toHaveBeenCalledWith('1')
        expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
        expect(mockExitAccountFlow).toHaveBeenCalled()
        expect(mockBuildHdWalletAccount).not.toHaveBeenCalled()
        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.NameAccount,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.RegisterAccount,
            {
                [AnalyticsMetadataKey.AccountCreationType]: 'create',
                [AnalyticsMetadataKey.ChainId]: 'algorand',
            },
        )
    })

    it('handleFinish tracks naming and registering an Ethereum watch account on ethereum', async () => {
        mockRouteParams = {
            account: {
                id: 'eth-watch',
                chains: { ethereum: { address: '0xabc' } },
                custody: { kind: 'watch' },
                name: 'Watched',
            },
            chainId: 'ethereum',
        }
        const { result } = renderHook(() => useNameAccountScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.NameAccount,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            OnboardingEvent.RegisterAccount,
            {
                [AnalyticsMetadataKey.AccountCreationType]: 'watch',
                [AnalyticsMetadataKey.ChainId]: 'ethereum',
            },
        )
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
                chains: { algorand: { address: 'ADDR', keyPairId: 'kp1' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                name: 'Old Name',
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
            id: 'new-account',
            chains: { algorand: { address: 'NEW_ADDR' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
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
            expect.objectContaining({
                chains: { algorand: { address: 'NEW_ADDR' } },
            }),
        )
        expect(mockSetSelectedAccountId).toHaveBeenCalledWith('new-account')
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
            chains: { algorand: { address: 'ADDR' } },
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
        })

        const { result } = renderHook(() => useNameAccountScreen())

        await act(async () => {
            await result.current.handleFinish()
        })

        expect(result.current.isCreating).toBe(false)
    })
})
