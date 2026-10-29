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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { renderHook, act } from '@testing-library/react'
import { useBidaliWebViewScreen } from '../useBidaliWebViewScreen'
import { useBidali } from '../../../hooks/useBidali'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// useBidaliClose dismisses the host sheet via useBottomSheetResult, which needs
// a bottom-sheet context this hook-only render doesn't provide — mock it to a
// stable spy so the screen hook can resolve its close handler.
const { mockBidaliClose } = vi.hoisted(() => ({ mockBidaliClose: vi.fn() }))
vi.mock('../../../hooks/useBidaliClose', () => ({
    useBidaliClose: () => mockBidaliClose,
}))

vi.mock('react-native', () => ({
    Linking: { openURL: vi.fn() },
    Platform: { OS: 'ios' },
}))

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        bidaliApiKey: 'test-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    },
    getPeraServicesConfig: () => ({
        bidaliApiKey: 'test-key',
        bidaliBaseUrl: 'https://commerce.bidali.com/dapp',
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedChainMode: () => 'live',
    useSelectedScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountBalancesQuery: (...args: unknown[]) => mockBalancesQuery(...args),
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        chainId: string,
    ) => account.chains[chainId],
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    sendFlowChainAdapters: { get: () => ({ buildTransferTxs: vi.fn() }) },
}))

const NATIVE_ASSET = vi.hoisted(() => ({ decimals: 6 }))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => NATIVE_ASSET,
    // Mirrors the real getKnownAssetId: `null` off the Pera-backed lane.
    getKnownAssetId: (
        key: string,
        { networkId: network }: { networkId: string },
    ) =>
        key === 'USDC'
            ? ({ mainnet: '31566704', testnet: '10458941' }[network] ?? null)
            : null,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const { displayUnitsToBaseUnits } = await vi.importActual<
        typeof import('@packages/shared/src/utils/unit-conversion')
    >('@packages/shared/src/utils/unit-conversion')
    return {
        ...(await vi.importActual<
            typeof import('@packages/shared/src/errors/base')
        >('@packages/shared/src/errors/base')),
        generateOrderedUniqueId: () => 'id',
        logger: {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
        },
        displayUnitsToBaseUnits,
    }
})

vi.mock('@hooks/useLanguage')

const { mockCapability, mockBalancesQuery } = vi.hoisted(() => ({
    mockCapability: vi.fn((_requirement: unknown) => true),
    mockBalancesQuery: vi.fn((..._args: unknown[]) => ({
        accountBalances: new Map(),
    })),
}))

vi.mock('@hooks/useCapability', () => ({
    useCapability: (requirement: unknown) => mockCapability(requirement),
}))

// The account's own chain, as useAccountScope resolves it.
vi.mock('../../../hooks/useGiftCardScope', () => ({
    useGiftCardScope: (account?: { chains: Record<string, unknown> }) => ({
        chainId:
            account && 'ethereum' in account.chains ? 'ethereum' : 'algorand',
        networkId: 'mainnet',
    }),
}))

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const mockAccount: WalletAccount = {
    id: 'bidali-webview-account',
    chains: {
        algorand: { address: VALID_ADDRESS, keyPairId: 'test-key-pair-id' },
    },
    name: 'Test',
    custody: { kind: 'local', seed: null },
}

// Stands in for the Algorand codec; this spec mocks the Algorand blockchain module.
beforeEach(() => {
    addressCodecs.register({
        ...fixtureCodec,
        chainId: LEGACY_CHAIN_ID,
        isValid: address => /^[A-Z2-7]{58}$/.test(address),
    })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('useBidaliWebViewScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCapability.mockReturnValue(true)
        const { result } = renderHook(() => useBidali())
        act(() => result.current.reset())
    })

    describe('url construction', () => {
        it('appends API key when configured', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.url).toBe(
                'https://commerce.bidali.com/dapp?key=test-key',
            )
        })
    })

    describe('navigation guard', () => {
        it('allows navigation within the Bidali origin', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())

            expect(
                result.current.onShouldStartLoadWithRequest({
                    url: 'https://commerce.bidali.com/checkout/123',
                } as never),
            ).toBe(true)
        })

        it('opens off-origin web navigations externally instead of in the webview', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() => useBidaliWebViewScreen())

            expect(
                result.current.onShouldStartLoadWithRequest({
                    url: 'https://evil.example/phish',
                } as never),
            ).toBe(false)
            expect(Linking.openURL).toHaveBeenCalledWith(
                'https://evil.example/phish',
            )
        })

        it('blocks non-web schemes outright', async () => {
            const { Linking } = await import('react-native')
            const { result } = renderHook(() => useBidaliWebViewScreen())

            expect(
                result.current.onShouldStartLoadWithRequest({
                    url: 'javascript:alert(1)',
                } as never),
            ).toBe(false)
            expect(Linking.openURL).not.toHaveBeenCalled()
        })
    })

    describe('bidaliProviderJS', () => {
        it('returns JS that sets up window.bidaliProvider', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.bidaliProviderJS).toContain(
                'window.bidaliProvider',
            )
        })
    })

    describe('onClose', () => {
        it('exposes the Bidali close handler', () => {
            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.onClose).toBe(mockBidaliClose)
        })
    })

    describe('selectedAccount passthrough', () => {
        it('provides handleMessage and webviewRef', () => {
            const { result: store } = renderHook(() => useBidali())
            act(() => store.current.setSelectedAccount(mockAccount))

            const { result } = renderHook(() => useBidaliWebViewScreen())
            expect(result.current.handleMessage).toBeTypeOf('function')
            expect(result.current.webviewRef).toBeDefined()
        })
    })
    describe('chain scope and gate', () => {
        it("scopes balances and the gate to an Algorand account's chain", () => {
            const { result: store } = renderHook(() => useBidali())
            act(() => store.current.setSelectedAccount(mockAccount))

            const { result } = renderHook(() => useBidaliWebViewScreen())

            expect(result.current.isAvailable).toBe(true)
            expect(mockCapability).toHaveBeenCalledWith({
                chain: { chainId: 'algorand', capability: 'giftCards' },
            })
            expect(mockBalancesQuery).toHaveBeenCalledWith(
                [mockAccount],
                { chainId: 'algorand', networkId: 'mainnet' },
                true,
            )
        })

        it("scopes balances and the gate to an Ethereum account's chain", () => {
            const ethereumAccount: WalletAccount = {
                id: 'bidali-ethereum-account',
                chains: { ethereum: { address: '0xA', keyPairId: 'kp' } },
                name: 'Eth',
                custody: { kind: 'local', seed: null },
            }
            mockCapability.mockReturnValue(false)
            const { result: store } = renderHook(() => useBidali())
            act(() => store.current.setSelectedAccount(ethereumAccount))

            const { result } = renderHook(() => useBidaliWebViewScreen())

            expect(mockCapability).toHaveBeenCalledWith({
                chain: { chainId: 'ethereum', capability: 'giftCards' },
            })
            expect(result.current.isAvailable).toBe(false)
            expect(mockBalancesQuery).toHaveBeenCalledWith(
                [ethereumAccount],
                { chainId: 'ethereum', networkId: 'mainnet' },
                false,
            )
        })
    })
})
