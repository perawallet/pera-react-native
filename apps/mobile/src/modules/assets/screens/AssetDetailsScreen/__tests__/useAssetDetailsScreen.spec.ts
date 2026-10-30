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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    useAssetOnChainSupplyQuery,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import { createEvmAddressCodec } from '@packages/chain-ethereum/src/accounts/address-codec'
import { AnalyticsMetadataKey, AssetDetailsEvent } from '@analytics'
import { algorandChainUi } from '@modules/algorand/chain-ui'
import { ethereumChainUi } from '@modules/ethereum/chain-ui'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { accountForType } from '@test-utils/accountCustody'
import { useAssetDetailsScreen } from '../useAssetDetailsScreen'

const ethereumDescriptor = evmChainOf('ethereum').descriptor
const ethereumAddressCodec = createEvmAddressCodec(evmChainOf('ethereum'))

const mocks = vi.hoisted(() => ({
    account: null as WalletAccount | null,
    trackEvent: vi.fn(),
    useResolvedAddress: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSelectedAccount: () => mocks.account,
}))

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: mocks.useResolvedAddress,
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mocks.trackEvent,
}))

const ETH_ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7'
const TRUNCATED_ETH_ADDRESS = ethereumAddressCodec.truncate(ETH_ADDRESS)
const ERC20_ID = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const ASA_ID = '31566704'

const ethereumAccount = (): WalletAccount => ({
    id: 'eth-account',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        algorand: { address: 'ALGO_ADDR' },
        ethereum: { address: ETH_ADDRESS },
    },
})

const assetFixture = (assetId: string, explorerUrl?: string): PeraAsset =>
    ({
        assetId,
        name: 'Fixture',
        decimals: 6,
        totalSupply: new Decimal('5000000'),
        peraMetadata: { explorerUrl },
    }) as PeraAsset

const mockAsset = (
    result:
        | { data: PeraAsset; isError?: boolean }
        | { data?: undefined; isError: true; isPending?: false },
) =>
    vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
        isPending: false,
        isError: false,
        ...result,
    } as unknown as ReturnType<typeof useSingleAssetDetailsQuery>)

describe('useAssetDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerEthereumChain()
        useRemoteConfigStore.getState().resetState()
        mocks.account = ethereumAccount()
        mocks.useResolvedAddress.mockReturnValue({
            displayName: TRUNCATED_ETH_ADDRESS,
            isNfd: false,
        })
    })

    it('renders an ERC-20 from its own chain with the descriptor explorer link and no chain sections', () => {
        mockAsset({ data: assetFixture(ERC20_ID) })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: ERC20_ID,
                chainId: 'ethereum',
                isCollectible: false,
            }),
        )

        const url = ethereumDescriptor.explorer.assetUrl(
            result.current.scope.networkId,
            ERC20_ID,
        )
        expect(url).toBe(`https://etherscan.io/token/${ERC20_ID}`)
        expect(result.current.scope.chainId).toBe('ethereum')
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            ERC20_ID,
            result.current.scope,
        )
        expect(result.current.assetDetailsDisplay).toBe(
            ethereumChainUi?.assetDetails,
        )
        expect(
            result.current.assetDetailsDisplay.VerificationSection,
        ).toBeUndefined()
        expect(
            result.current.assetDetailsDisplay.IssuerControlsSection,
        ).toBeUndefined()
        expect(result.current.supply?.labelKey).toBe(
            'asset_details.markets.total_supply',
        )
        expect(result.current.supply?.amount?.toFixed()).toBe('5000000')
        expect(result.current.about).toEqual({
            idLabelKey: 'asset_details.collectible.contract',
            urlLabelKey: 'asset_details.about.url',
            explorerLink: { url, label: new URL(url as string).hostname },
        })
        expect(result.current.headerPrimary).toBe(TRUNCATED_ETH_ADDRESS)
        expect(result.current.headerSecondary).toBeUndefined()
        expect(result.current.isLoading).toBe(false)
    })

    it("gives an Algorand ASA Algorand's sections and labels", () => {
        mocks.account = accountForType('standalone')
        mockAsset({ data: assetFixture(ASA_ID, 'https://explorer.test/asset') })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: ASA_ID,
                chainId: 'algorand',
                isCollectible: false,
            }),
        )

        expect(result.current.assetDetailsDisplay).toBe(
            algorandChainUi.assetDetails,
        )
        expect(result.current.about?.idLabelKey).toBe(
            'asset_details.about.asa_id',
        )
    })

    it('hides the id row and links the explorer front page for ETH', () => {
        const nativeId = ethereumDescriptor.nativeAsset.ref.assetId
        mockAsset({ data: assetFixture(nativeId) })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: nativeId,
                chainId: 'ethereum',
                isCollectible: false,
            }),
        )

        expect(result.current.about?.idLabelKey).toBeNull()
        expect(result.current.about?.explorerLink?.label).toBe('etherscan.io')
        expect(result.current.supply).toEqual({
            labelKey: 'asset_details.markets.circulating_supply',
            infoBodyKey: 'asset_details.markets.circulating_supply_info_body',
            amount: null,
        })
    })

    describe('when the stored supply is unknown', () => {
        const zeroSupply = (assetId: string): PeraAsset => ({
            ...assetFixture(assetId),
            totalSupply: new Decimal(0),
        })
        beforeEach(() => {
            vi.mocked(useAssetOnChainSupplyQuery).mockReturnValue({
                totalSupply: null,
            })
        })

        const render = (assetId: string, isCollectible = false) =>
            renderHook(() =>
                useAssetDetailsScreen({
                    assetId,
                    chainId: 'ethereum',
                    isCollectible,
                }),
            )

        it("reads a token's supply from the chain and shows it", () => {
            mockAsset({ data: zeroSupply(ERC20_ID) })
            vi.mocked(useAssetOnChainSupplyQuery).mockReturnValue({
                totalSupply: new Decimal('61234567890000000'),
            })

            const { result } = render(ERC20_ID)

            expect(useAssetOnChainSupplyQuery).toHaveBeenCalledWith(
                ERC20_ID,
                result.current.scope,
                true,
            )
            expect(result.current.supply?.amount?.toFixed()).toBe(
                '61234567890000000',
            )
        })

        it('shows no figure while the chain has not answered', () => {
            mockAsset({ data: zeroSupply(ERC20_ID) })

            const { result } = render(ERC20_ID)

            expect(result.current.supply?.amount).toBeNull()
        })

        it('makes no chain read for a collectible, which has no ERC-20 surface', () => {
            mockAsset({ data: zeroSupply(ERC20_ID) })
            render(ERC20_ID, true)
            mockAsset({
                data: {
                    ...zeroSupply(ERC20_ID),
                    peraMetadata: {
                        isDeleted: false,
                        verificationTier: 'unverified',
                        type: 'collectible',
                    },
                },
            })
            render(ERC20_ID)

            expect(useAssetOnChainSupplyQuery).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                true,
            )
        })

        it('makes no chain read for the native coin or a token with a stored supply', () => {
            const nativeId = ethereumDescriptor.nativeAsset.ref.assetId
            mockAsset({ data: zeroSupply(nativeId) })
            render(nativeId)
            mockAsset({ data: assetFixture(ERC20_ID) })
            render(ERC20_ID)

            expect(useAssetOnChainSupplyQuery).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                true,
            )
        })
    })

    it('reports an error rather than loading forever when the metadata fails', () => {
        mockAsset({ data: undefined, isError: true })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: ERC20_ID,
                chainId: 'ethereum',
                isCollectible: false,
            }),
        )

        expect(result.current.isError).toBe(true)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.about).toBeNull()
        expect(result.current.supply).toBeNull()
    })

    it('keeps a loaded asset when a background refetch fails', () => {
        mockAsset({ data: assetFixture(ERC20_ID), isError: true })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: ERC20_ID,
                chainId: 'ethereum',
                isCollectible: false,
            }),
        )

        expect(result.current.isError).toBe(false)
        expect(result.current.asset).toBeDefined()
        expect(result.current.about).not.toBeNull()
    })

    it('fires the Show event once per asset, and never for a collectible', () => {
        mockAsset({ data: assetFixture(ERC20_ID) })
        const params = {
            assetId: ERC20_ID,
            chainId: 'ethereum',
            isCollectible: false,
        } as const

        const { rerender } = renderHook(() => useAssetDetailsScreen(params))
        rerender()

        expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
        expect(mocks.trackEvent).toHaveBeenCalledWith(AssetDetailsEvent.Show, {
            [AnalyticsMetadataKey.AssetId]: ERC20_ID,
            [AnalyticsMetadataKey.ChainId]: 'ethereum',
        })

        mocks.trackEvent.mockClear()
        renderHook(() =>
            useAssetDetailsScreen({ ...params, isCollectible: true }),
        )

        expect(mocks.trackEvent).not.toHaveBeenCalled()
    })

    it("shows a named account's secondary address truncated for the asset's chain", () => {
        mocks.account = { ...ethereumAccount(), name: 'Savings' }
        mockAsset({ data: assetFixture(ERC20_ID) })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: ERC20_ID,
                chainId: 'ethereum',
                isCollectible: false,
            }),
        )

        expect(result.current.headerPrimary).toBe('Savings')
        expect(result.current.headerSecondary).toBe(TRUNCATED_ETH_ADDRESS)
        expect(mocks.useResolvedAddress).toHaveBeenCalledWith(
            ETH_ADDRESS,
            expect.objectContaining({ chainId: 'ethereum' }),
            { enabled: true },
        )
    })

    it('still renders when the account has no address on the asset chain', () => {
        mocks.account = accountForType('standalone')
        mockAsset({ data: assetFixture(ERC20_ID) })

        const { result } = renderHook(() =>
            useAssetDetailsScreen({
                assetId: ERC20_ID,
                chainId: 'ethereum',
                isCollectible: false,
            }),
        )

        expect(mocks.useResolvedAddress).toHaveBeenCalledWith(
            '',
            expect.objectContaining({ chainId: 'ethereum' }),
            { enabled: false },
        )
        expect(result.current.isLoading).toBe(false)
        expect(result.current.headerPrimary).toBe('No Address Found')
    })

    describe('chain resolution', () => {
        it('names the network and keeps Markets for an account on several chains', () => {
            mockAsset({ data: assetFixture(ERC20_ID) })

            const { result } = renderHook(() =>
                useAssetDetailsScreen({
                    assetId: ERC20_ID,
                    chainId: 'ethereum',
                    isCollectible: false,
                }),
            )

            expect(result.current.scope.chainId).toBe('ethereum')
            expect(result.current.isNetworkLineVisible).toBe(true)
            expect(result.current.isMarketsTabVisible).toBe(true)
        })

        it("names the network for an Algorand asset on an account that's on several chains", () => {
            mockAsset({ data: assetFixture(ASA_ID) })

            const { result } = renderHook(() =>
                useAssetDetailsScreen({
                    assetId: ASA_ID,
                    chainId: 'algorand',
                    isCollectible: false,
                }),
            )

            expect(result.current.scope.chainId).toBe('algorand')
            expect(result.current.isNetworkLineVisible).toBe(true)
        })

        it('renders a single-chain account as before: no network line, Markets shown', () => {
            mocks.account = accountForType('standalone')
            mockAsset({ data: assetFixture(ASA_ID) })

            const { result } = renderHook(() =>
                useAssetDetailsScreen({
                    assetId: ASA_ID,
                    chainId: 'algorand',
                    isCollectible: false,
                }),
            )

            expect(result.current.isNetworkLineVisible).toBe(false)
            expect(result.current.isMarketsTabVisible).toBe(true)
        })

        it("hides Markets when the asset's chain has no pricing", () => {
            setCapabilityOverrides({ pricing: false }, 'ethereum')
            mockAsset({ data: assetFixture(ERC20_ID) })

            const { result } = renderHook(() =>
                useAssetDetailsScreen({
                    assetId: ERC20_ID,
                    chainId: 'ethereum',
                    isCollectible: false,
                }),
            )

            expect(result.current.isMarketsTabVisible).toBe(false)
        })
    })
})
