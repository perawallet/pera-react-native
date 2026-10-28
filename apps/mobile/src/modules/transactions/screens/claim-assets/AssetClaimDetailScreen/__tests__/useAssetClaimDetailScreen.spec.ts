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
const mockErrorToast = vi.fn()

let mockAssetRequests: unknown[] = []

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        assetRequests: mockAssetRequests,
        accountAddress: 'ACCOUNT_ADDR',
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [
        { chains: { algorand: { address: 'ACCOUNT_ADDR' } }, name: 'Main' },
        { chains: { ethereum: { address: 'ACCOUNT_ADDR' } }, name: 'Eth' },
    ],
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush, navigate: mockNavigate }),
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
    useToast: () => ({ errorToast: mockErrorToast }),
}))

const buildRequest = (
    overrides: {
        insufficientNativeForClaiming?: boolean
        shouldUseFundsBeforeClaiming?: boolean
        insufficientNativeForRejecting?: boolean
        shouldUseFundsBeforeRejecting?: boolean
        nativeGainOnClaim?: Decimal
        nativeGainOnReject?: Decimal
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

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Fund' })
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
        expect(mockErrorToast).toHaveBeenCalled()
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

            it('carries the scope into a confirmed reject', async () => {
                mockRequestBottomSheet.mockResolvedValueOnce(true)
                mockAssetRequests = [
                    buildRequest({ nativeGainOnReject: gainBaseUnits }),
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
                        scope,
                    },
                })
            })
        },
    )
})
