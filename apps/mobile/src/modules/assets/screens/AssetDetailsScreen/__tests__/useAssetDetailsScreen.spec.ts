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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { ethereumDescriptor } from '@packages/chain-ethereum/src/descriptor'
import { AnalyticsMetadataKey, AssetDetailsEvent } from '@analytics'
import { algorandChainUi } from '@modules/algorand/chain-ui'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { accountForType } from '@test-utils/accountCustody'
import { useAssetDetailsScreen } from '../useAssetDetailsScreen'
import { neutralAssetDetailsDisplay } from '../neutralAssetDetailsDisplay'

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
    ({ assetId, name: 'Fixture', peraMetadata: { explorerUrl } }) as PeraAsset

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
        mocks.account = ethereumAccount()
        mocks.useResolvedAddress.mockReturnValue({ displayName: 'resolved' })
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
        expect(result.current.scope.chainId).toBe('ethereum')
        expect(useSingleAssetDetailsQuery).toHaveBeenCalledWith(
            ERC20_ID,
            result.current.scope,
        )
        expect(result.current.assetDetailsDisplay).toBe(
            neutralAssetDetailsDisplay,
        )
        expect(
            result.current.assetDetailsDisplay.VerificationSection,
        ).toBeUndefined()
        expect(
            result.current.assetDetailsDisplay.IssuerControlsSection,
        ).toBeUndefined()
        expect(result.current.about).toEqual({
            idLabelKey: 'asset_details.collectible.asset_id',
            urlLabelKey: 'asset_details.about.url',
            explorerLink: { url, label: new URL(url as string).hostname },
        })
        expect(result.current.headerPrimary).toBe(ETH_ADDRESS)
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

    it('hides the id row and the explorer row for ETH', () => {
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
        expect(result.current.about?.explorerLink).toBeNull()
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
        })

        mocks.trackEvent.mockClear()
        renderHook(() =>
            useAssetDetailsScreen({ ...params, isCollectible: true }),
        )

        expect(mocks.trackEvent).not.toHaveBeenCalled()
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

        expect(mocks.useResolvedAddress).toHaveBeenCalledWith('', {
            enabled: false,
        })
        expect(result.current.isLoading).toBe(false)
        expect(result.current.headerPrimary).toBe('No Address Found')
    })
})
