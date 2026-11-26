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

import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { imitatedCurrencyOf } from '@perawallet/wallet-core-currencies'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { registerAlgorandRampAdapter } from '@test-utils/rampChainAdapter'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useAssetClaimDetailScreen } from '../useAssetClaimDetailScreen'

const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM_SCOPE = { chainId: ETHEREUM_CHAIN_ID, networkId: 'sepolia' }

const { routeParams, mockRequestBottomSheet } = vi.hoisted(() => ({
    routeParams: { current: {} as Record<string, unknown> },
    mockRequestBottomSheet: vi.fn(),
}))

const mockPush = vi.fn()
const mockNavigate = vi.fn()
const mockGoBack = vi.fn()
const mockErrorToast = vi.fn()
const mockShowToast = vi.fn()
const { mockSetTokenKept, mockSetTokenHidden } = vi.hoisted(() => ({
    mockSetTokenKept: vi.fn(),
    mockSetTokenHidden: vi.fn(),
}))

let mockAssetRequests: unknown[] = []

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        assetRequests: mockAssetRequests,
        accountAddress: 'ACCOUNT_ADDR',
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    // The real scope, so a spec can switch onramp off.
    useAccountCapabilityScope: (
        await vi.importActual<
            typeof import('@perawallet/wallet-core-accounts')
        >('@perawallet/wallet-core-accounts')
    ).useAccountCapabilityScope,
    useAllAccounts: () => [
        { chains: { algorand: { address: 'ACCOUNT_ADDR' } }, name: 'Main' },
        { chains: { ethereum: { address: 'ACCOUNT_ADDR' } }, name: 'Eth' },
    ],
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
    receivesUnaskedAssets: (chainId: string) => chainId === 'ethereum',
    useKeptTokensStore: (
        selector: (state: { setTokenKept: typeof mockSetTokenKept }) => unknown,
    ) => selector({ setTokenKept: mockSetTokenKept }),
    useHiddenTokensStore: (
        selector: (state: {
            setTokenHidden: typeof mockSetTokenHidden
        }) => unknown,
    ) => selector({ setTokenHidden: mockSetTokenHidden }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        navigate: mockNavigate,
        goBack: mockGoBack,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams.current }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: vi.fn() }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        showToast: mockShowToast,
    }),
}))

const buildRequest = (
    overrides: {
        insufficientNativeForClaiming?: boolean
        shouldUseFundsBeforeClaiming?: boolean
        insufficientNativeForRejecting?: boolean
        shouldUseFundsBeforeRejecting?: boolean
        nativeGainOnClaim?: Decimal
        nativeGainOnReject?: Decimal
        asset?: {
            assetId: string
            decimals: number
            name: string
            unitName?: string
            peraMetadata?: { verificationTier: string }
        }
    } = {},
) => ({
    id: '123',
    inboxAddress: 'INBOX_ADDR',
    totalAmount: new Decimal(5),
    asset: { assetId: '123', decimals: 0, name: 'TEST' },
    usdValue: null,
    nativeGainOnClaim: new Decimal(0),
    nativeGainOnReject: new Decimal(0),
    senders: { count: 0, results: [] },
    insufficientNativeForClaiming: false,
    insufficientNativeForRejecting: false,
    shouldUseFundsBeforeClaiming: false,
    shouldUseFundsBeforeRejecting: false,
    ...overrides,
})

describe('useAssetClaimDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandRampAdapter()
        routeParams.current = { assetIndex: 0, scope: ALGORAND_SCOPE }
        mockAssetRequests = [buildRequest()]
    })

    describe('imitated currency', () => {
        it('reports the code the claimed asset imitates', () => {
            vi.mocked(imitatedCurrencyOf).mockReturnValueOnce('USD')
            mockAssetRequests = [
                buildRequest({
                    asset: {
                        assetId: '123',
                        decimals: 0,
                        name: 'Spoof',
                        unitName: 'usd',
                    },
                }),
            ]

            const { result } = renderHook(() => useAssetClaimDetailScreen())

            expect(result.current.imitatedCurrency).toBe('USD')
            expect(imitatedCurrencyOf).toHaveBeenCalledWith(
                { chainId: 'algorand', assetId: '123' },
                'usd',
            )
        })

        it('judges the payload asset id and the unit name it renders', () => {
            mockAssetRequests = [
                buildRequest({
                    asset: {
                        assetId: '123',
                        decimals: 0,
                        name: 'TEST',
                        unitName: 'TST',
                    },
                }),
            ]

            const { result } = renderHook(() => useAssetClaimDetailScreen())

            expect(result.current.imitatedCurrency).toBeNull()
            expect(imitatedCurrencyOf).toHaveBeenCalledWith(
                { chainId: 'algorand', assetId: '123' },
                'TST',
            )
        })

        it('is null when there is no request', () => {
            mockAssetRequests = []

            const { result } = renderHook(() => useAssetClaimDetailScreen())

            expect(result.current.imitatedCurrency).toBeNull()
            expect(imitatedCurrencyOf).not.toHaveBeenCalled()
        })
    })

    it('does not block a claim the account can afford', () => {
        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isClaimBlocked).toBe(false)
    })

    it('blocks the claim when the account cannot cover the opt-in', () => {
        mockAssetRequests = [
            buildRequest({ insufficientNativeForClaiming: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isClaimBlocked).toBe(true)
    })

    it('does not block when the inbox funds cover the opt-in', () => {
        mockAssetRequests = [
            buildRequest({
                insufficientNativeForClaiming: true,
                shouldUseFundsBeforeClaiming: true,
            }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isClaimBlocked).toBe(false)

        act(() => {
            result.current.handleClaim()
        })

        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'ClaimProcessing',
            params: {
                mode: 'claim',
                assetIndex: 0,
                shouldClaimAlgo: true,
                scope: ALGORAND_SCOPE,
            },
        })
    })

    it('blocks the reject when the account cannot cover its fee', () => {
        mockAssetRequests = [
            buildRequest({ insufficientNativeForRejecting: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isRejectBlocked).toBe(true)
        expect(result.current.isClaimBlocked).toBe(false)
    })

    it('does not block the reject when the inbox funds cover the fee', () => {
        mockAssetRequests = [
            buildRequest({
                insufficientNativeForRejecting: true,
                shouldUseFundsBeforeRejecting: true,
            }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        expect(result.current.isRejectBlocked).toBe(false)
    })

    it('sends the user to the fund tab to cover the shortfall', () => {
        mockAssetRequests = [
            buildRequest({ insufficientNativeForClaiming: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        act(() => {
            result.current.handleAddFunds()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Fund',
            params: { chainId: 'algorand' },
        })
    })

    it("offers the Add Funds button only while the receiving account's chain has onramp", () => {
        useRemoteConfigStore.getState().resetState()
        const { result, rerender } = renderHook(() =>
            useAssetClaimDetailScreen(),
        )
        expect(result.current.canBuy).toBe(true)

        act(() => setCapabilityOverrides({ onramp: false }))
        rerender()

        expect(result.current.canBuy).toBe(false)
    })

    it('never navigates to processing while the claim is blocked', () => {
        mockAssetRequests = [
            buildRequest({ insufficientNativeForClaiming: true }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())

        act(() => {
            result.current.handleClaim()
        })

        expect(mockPush).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalledWith(
            'errors.transaction.title',
            expect.stringContaining('messages.claim.insufficient_native_claim'),
        )
    })

    describe.each([
        {
            scope: ALGORAND_SCOPE,
            gainBaseUnits: new Decimal(1_500_000),
            nativeSymbol: 'ALGO',
            accountName: 'Main',
        },
        {
            scope: ETHEREUM_SCOPE,
            gainBaseUnits: new Decimal('1500000000000000000'),
            nativeSymbol: 'ETH',
            accountName: 'Eth',
        },
    ])(
        'opened for $scope.chainId',
        ({ scope, gainBaseUnits, nativeSymbol, accountName }) => {
            beforeEach(() => {
                registerEthereumChain()
                routeParams.current = { assetIndex: 0, scope }
            })

            afterEach(() => {
                restoreAlgorandOnlyChains()
            })

            it("resolves the receiving account on the scope's chain", () => {
                const { result } = renderHook(() => useAssetClaimDetailScreen())

                expect(result.current.receiverAccount).toEqual(
                    expect.objectContaining({ name: accountName }),
                )
            })

            it('labels the claim gain in the native asset', () => {
                mockAssetRequests = [
                    buildRequest({ nativeGainOnClaim: gainBaseUnits }),
                ]

                const { result } = renderHook(() => useAssetClaimDetailScreen())

                expect(result.current.nativeSymbol).toBe(nativeSymbol)
                expect(result.current.claimGainLabel).toBe(
                    `1.50 ${nativeSymbol}`,
                )
            })

            it('has no claim gain label when the claim credits nothing', () => {
                const { result } = renderHook(() => useAssetClaimDetailScreen())

                expect(result.current.claimGainLabel).toBeNull()
            })
        },
    )

    it('carries the scope into a confirmed reject', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        mockAssetRequests = [
            buildRequest({ nativeGainOnReject: new Decimal(1_500_000) }),
        ]

        const { result } = renderHook(() => useAssetClaimDetailScreen())
        await act(async () => {
            result.current.handleRejectPress()
        })

        expect(mockPush).toHaveBeenCalledWith('Messages', {
            screen: 'ClaimProcessing',
            params: {
                mode: 'reject',
                assetIndex: 0,
                shouldClaimAlgo: false,
                scope: ALGORAND_SCOPE,
            },
        })
    })

    describe('a token on a chain without opt-in', () => {
        const token = {
            address: 'ACCOUNT_ADDR',
            scope: ETHEREUM_SCOPE,
            assetId: '123',
        }

        beforeEach(() => {
            routeParams.current = { assetIndex: 0, scope: ETHEREUM_SCOPE }
        })

        it('accepts the token on the device, with no transaction', () => {
            const { result } = renderHook(() => useAssetClaimDetailScreen())

            act(() => result.current.handleClaim())

            expect(result.current.isTokenInbox).toBe(true)
            expect(mockSetTokenKept).toHaveBeenCalledWith({
                ...token,
                isKept: true,
            })
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: expect.stringContaining(
                        'asset_inbox.claim.token_accepted_toast',
                    ),
                }),
            )
            expect(mockGoBack).toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('hides the token once the user confirms the reject', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(true)

            const { result } = renderHook(() => useAssetClaimDetailScreen())
            await act(async () => {
                result.current.handleRejectPress()
            })

            expect(mockSetTokenHidden).toHaveBeenCalledWith({
                ...token,
                isHidden: true,
            })
            expect(mockGoBack).toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('leaves the token waiting when the reject is cancelled', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(false)

            const { result } = renderHook(() => useAssetClaimDetailScreen())
            await act(async () => {
                result.current.handleRejectPress()
            })

            expect(mockSetTokenHidden).not.toHaveBeenCalled()
            expect(mockGoBack).not.toHaveBeenCalled()
        })

        it('flags a token Pera marks suspicious', () => {
            mockAssetRequests = [
                buildRequest({
                    asset: {
                        assetId: '123',
                        decimals: 0,
                        name: 'Claim rewards',
                        peraMetadata: { verificationTier: 'suspicious' },
                    },
                }),
            ]

            const { result } = renderHook(() => useAssetClaimDetailScreen())

            expect(result.current.isSuspicious).toBe(true)
        })
    })
})
