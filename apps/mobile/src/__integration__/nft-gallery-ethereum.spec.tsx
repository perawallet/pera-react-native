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

// An Ethereum account's NFTs from the Pera nfts service, through the account
// sync into the gallery and the detail screen. The gallery is read through
// `useAccountNfts`, as nft-gallery.spec.tsx does: FlashList renders nothing
// useful under jsdom.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    onTestFinished,
    vi,
} from 'vitest'
import { Linking } from 'react-native'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['nfts'])
    return {
        ...withBackend,
        // The chain context reads its services here, not from `hasPeraService`.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? new Set(['assets', 'nfts'] as const)
                : withBackend.peraServicesFor(scope),
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: [RPC_URL], sepolia: [RPC_URL] }
                : withBackend.chainEndpointsFor(chainId),
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { act, fireEvent, renderHook, screen, waitFor } =
    await import('@testing-library/react')
const {
    assetFromHoldingLiteRow,
    fetchAndPersistAccount,
    getAccountHoldings,
    useAccountChainStateStore,
    useHiddenTokensStore,
    useHoldingsRefreshStore,
} = await import('@perawallet/wallet-core-accounts')
const { useCollectiblePreferencesStore } =
    await import('@perawallet/wallet-core-assets')
const { evmNftItem, evmRpcHandlers, peraEvmHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { createQueryClientWrapper, render } = await import('@test-utils/render')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { useAccountNfts } =
    await import('@modules/accounts/components/AccountNfts/useAccountNfts')
const { CollectibleDetailScreen } = await import('@modules/assets/routes')
const { useCollectibleDetail } =
    await import('@modules/assets/screens/CollectibleDetailScreen/useCollectibleDetail')
const { useCollectibleThumbnail } =
    await import('@modules/assets/components/CollectibleThumbnail/useCollectibleThumbnail')
const { useWebViewStore } = await import('@modules/webview')
const { ETH_SCOPE, ETHEREUM_SENDER, selectSender, SENDER } =
    await import('./__fixtures__/ethereum-send')

const APE_CONTRACT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const APE_ID = `${APE_CONTRACT}/1234`
const ITEM_CONTRACT = '0x76BE3b62873462d2142405439777e971754E8E77'
const ITEM_ID = `${ITEM_CONTRACT}/10`
const ITEM_CAIP19 = `eip155:1/erc1155:${ITEM_CONTRACT.toLowerCase()}/10`

const ape = () => evmNftItem()
const swords = () =>
    evmNftItem({
        asset_id: ITEM_CAIP19,
        standard: 'erc1155',
        token_id: '10',
        balance: '3',
        name: 'Item #10',
        description: 'A stack of items.',
        collection: {
            address: ITEM_CONTRACT.toLowerCase(),
            name: 'Items',
            symbol: 'ITEM',
            verification_tier: 'verified',
        },
        primary_image: {
            url: 'https://nft.pera.test/items/10.png',
            preview_url: null,
        },
        media: [
            {
                url: 'https://nft.pera.test/items/10.png',
                preview_url: null,
                mime_type: null,
            },
        ],
        traits: [{ trait_type: 'Rarity', value: 'Epic' }],
        explorer_url: `https://etherscan.io/nft/${ITEM_CONTRACT}/10`,
    })

const serveChain = () => server.use(...evmRpcHandlers({ rpcUrl: RPC_URL }))

const serveHoldings = (nftHoldings: Parameters<typeof peraEvmHandlers>[0]) =>
    server.use(...peraEvmHandlers(nftHoldings))

const sync = () => fetchAndPersistAccount(SENDER, ETH_SCOPE)

const heldNftAmounts = async () =>
    Object.fromEntries(
        (
            await getAccountHoldings({
                accountAddress: SENDER,
                scope: ETH_SCOPE,
            })
        )
            .filter(holding => holding.assetId.includes('/'))
            .map(holding => [holding.assetId, holding.amount.toFixed()]),
    )

// The gallery as the screen reads it, once the list has settled.
const readGallery = async () => {
    const hook = renderHook(() => useAccountNfts(), {
        wrapper: createQueryClientWrapper(),
    })
    await waitFor(() => expect(hook.result.current.isPending).toBe(false), {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })
    return hook
}

describe('Flow: an Ethereum account with NFTs', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountChainStateStore.getState().resetState()
        useHoldingsRefreshStore.getState().resetState()
        useHiddenTokensStore.getState().resetState()
        useCollectiblePreferencesStore.getState().resetState()
        useWebViewStore.getState().clearWebViews()
        selectSender(ETHEREUM_SENDER)
        serveChain()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('Given an ERC-721 and an ERC-1155 of 3 on two pages, when the account syncs, then the gallery lists both with image, title, collection and quantity', async () => {
        serveHoldings({
            nftHoldings: { [SENDER.toLowerCase()]: [[ape()], [swords()]] },
        })

        await sync()
        const { result } = await readGallery()

        await waitFor(() => expect(result.current.collectibleCount).toBe(2))
        const rows = Object.fromEntries(
            result.current.collectibles.map(row => {
                const asset = assetFromHoldingLiteRow(row, 'ethereum')
                return [
                    row.assetId,
                    {
                        title: asset?.peraMetadata?.collectible?.title,
                        collection:
                            asset?.peraMetadata?.collectible?.collection?.name,
                        image: asset?.peraMetadata?.collectible?.primaryImage,
                        amount: row.amount.toFixed(),
                    },
                ]
            }),
        )
        expect(rows).toEqual({
            [APE_ID]: {
                title: 'Bored Ape #1234',
                collection: 'Bored Ape Yacht Club',
                image: 'https://nft.pera.test/bayc/1234-preview.png',
                amount: '1',
            },
            [ITEM_ID]: {
                title: 'Item #10',
                collection: 'Items',
                image: 'https://nft.pera.test/items/10.png',
                amount: '3',
            },
        })
        expect(result.current.refreshNoticeChainNames).toBeUndefined()
    })

    it('Given a synced ERC-1155, when its detail opens, then it shows the contract, token id, standard, traits and an Etherscan link that opens in the system browser', async () => {
        serveHoldings({
            nftHoldings: { [SENDER.toLowerCase()]: [[swords()]] },
            nfts: { [ITEM_CAIP19]: swords() },
        })
        await sync()

        renderWithNavigation(CollectibleDetailScreen, 'CollectibleDetails', {
            initialParams: { assetId: ITEM_ID, chainId: 'ethereum' },
        })

        const standard = await screen.findByTestId(
            'collectible_standard',
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(standard.textContent).toBe('ERC-1155')
        expect(
            screen.getByText('asset_details.collectible.token_id').parentElement
                ?.textContent,
        ).toBe('asset_details.collectible.token_id10')
        expect(
            screen.getByText('asset_details.collectible.contract').parentElement
                ?.textContent,
        ).toMatch(/^asset_details\.collectible\.contract0x76BE.*8E77$/)
        expect(screen.getByText('Rarity')).toBeTruthy()
        expect(screen.getByText('Epic')).toBeTruthy()

        const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
        onTestFinished(() => openURL.mockRestore())
        fireEvent.click(screen.getByText('etherscan.io'))

        expect(openURL).toHaveBeenCalledWith(
            `https://etherscan.io/nft/${ITEM_CONTRACT}/10`,
        )
        expect(useWebViewStore.getState().openWebViews).toEqual([])
    })

    it('Given both NFTs synced, when the user hides the ERC-721 from its detail, then the gallery and count leave it out until Display Hidden NFTs is on', async () => {
        serveHoldings({
            nftHoldings: { [SENDER.toLowerCase()]: [[ape()], [swords()]] },
        })
        await sync()

        // The test navigator hides headers, where the screen puts this menu,
        // so the press goes to the item the detail's hook hands it.
        const detail: {
            current?: ReturnType<typeof useCollectibleDetail>
        } = {}
        const DetailProbe = () => {
            detail.current = useCollectibleDetail(APE_ID, 'ethereum')
            return null
        }
        const probe = render(<DetailProbe />)
        await waitFor(
            () => expect(detail.current?.headerMenuItems).toHaveLength(1),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        act(() => detail.current!.headerMenuItems[0]!.onPress())
        probe.unmount()

        const { result, unmount } = await readGallery()
        await waitFor(() => expect(result.current.collectibleCount).toBe(1))
        expect(result.current.collectibles[0].assetId).toBe(ITEM_ID)
        unmount()

        useCollectiblePreferencesStore.getState().setShowHidden(true)
        const shown = await readGallery()
        await waitFor(() =>
            expect(shown.result.current.collectibleCount).toBe(2),
        )
    })

    it('Given media the backend should not have served (an IPFS link, an SVG data URL), when the account syncs, then the schema drops them and the item shows the placeholder', async () => {
        serveHoldings({
            nftHoldings: {
                [SENDER.toLowerCase()]: [
                    [
                        evmNftItem({
                            primary_image: {
                                url: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
                                preview_url: null,
                            },
                            media: [
                                {
                                    url: 'data:image/svg+xml,<svg onload="x()"/>',
                                    preview_url: null,
                                    mime_type: 'image/svg+xml',
                                },
                            ],
                        }),
                    ],
                ],
            },
        })

        await sync()
        const { result } = await readGallery()

        await waitFor(() => expect(result.current.collectibleCount).toBe(1))
        const collectible = assetFromHoldingLiteRow(
            result.current.collectibles[0],
            'ethereum',
        )?.peraMetadata?.collectible
        expect(collectible?.primaryImage).toBeUndefined()
        expect(collectible?.media).toEqual([])
        const thumbnail = renderHook(() =>
            useCollectibleThumbnail({
                thumbnailUrl: collectible?.primaryImage,
            }),
        )
        expect(thumbnail.result.current.showPlaceholder).toBe(true)
    })

    it('Given both NFTs synced, when a later refresh no longer lists the ERC-721, then it leaves the gallery', async () => {
        serveHoldings({
            nftHoldings: { [SENDER.toLowerCase()]: [[ape()], [swords()]] },
        })
        await sync()
        expect(await heldNftAmounts()).toEqual({
            [APE_ID]: '1',
            [ITEM_ID]: '3',
        })

        server.resetHandlers()
        serveChain()
        serveHoldings({
            nftHoldings: { [SENDER.toLowerCase()]: [[swords()]] },
        })
        await sync()
        const { result } = await readGallery()

        expect(await heldNftAmounts()).toEqual({ [ITEM_ID]: '3' })
        await waitFor(() => expect(result.current.collectibleCount).toBe(1))
        expect(result.current.collectibles[0].assetId).toBe(ITEM_ID)
    })

    it.each([502, 503])(
        'Given both NFTs synced, when a refresh gets a %s, then both stay with a refresh notice naming the network, never the empty state',
        async status => {
            serveHoldings({
                nftHoldings: { [SENDER.toLowerCase()]: [[ape()], [swords()]] },
            })
            await sync()

            server.resetHandlers()
            serveChain()
            serveHoldings({ nftHoldings: status })
            await sync()
            const { result } = await readGallery()

            await waitFor(() =>
                expect(result.current.refreshNoticeChainNames).toBe('Ethereum'),
            )
            expect(result.current.collectibleCount).toBe(2)
            expect(result.current.showEmptyState).toBe(false)
            expect(await heldNftAmounts()).toEqual({
                [APE_ID]: '1',
                [ITEM_ID]: '3',
            })
        },
    )

    it('Given the first sync gets a 503, when the gallery opens, then it shows the load error with Retry, never "no NFTs yet"', async () => {
        serveHoldings({ nftHoldings: 503 })

        await sync()
        const { result } = await readGallery()

        await waitFor(() =>
            expect(result.current.listEmptyTitle).toBe(
                'account_details.nfts.load_error_title',
            ),
        )
        expect(result.current.isLoadFailed).toBe(true)
        expect(result.current.showEmptyState).toBe(false)
        expect(result.current.refreshNoticeChainNames).toBeUndefined()
    })
})
