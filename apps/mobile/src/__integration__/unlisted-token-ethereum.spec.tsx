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

// A token Pera's list doesn't name reaches the account by its contract
// address: Add Asset reads it from the chain and the add reads the account's
// balance of it at once. No sync tick runs here, so every balance comes from
// the add's own read. Sending one is in send-ethereum.spec.tsx.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        // The chain context reads its services here, not from `hasPeraService`.
        peraServicesFor: (scope: ChainScope) =>
            scope.chainId === 'ethereum'
                ? new Set(['assets'] as const)
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
const { fireEvent, screen, waitFor, within } =
    await import('@testing-library/react')
const { Decimal } = await import('decimal.js')
const {
    addAccountToken,
    fetchAndPersistAccount,
    getAccountAddedTokens,
    getAccountFundedNetworks,
    getAccountHoldings,
    useAccountChainStateStore,
} = await import('@perawallet/wallet-core-accounts')
const { fetchAndPersistAssets, getAssetById, PeraAssetVerificationTier } =
    await import('@perawallet/wallet-core-assets')
const {
    erc20CallResponder,
    evmRpcHandlers,
    peraEvmHandlers,
    unknownAssetItem,
} = await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { useBottomSheetStore } = await import('@modules/bottom-sheet')
const { AddAssetView } = await import('@modules/assets/components/AddAssetView')
const { useSendFundsStore } = await import('@modules/transactions')
const { AssetSelectionScreen } =
    await import('@modules/transactions/screens/send-funds/AssetSelectionScreen')
const { ETH_SCOPE, ETHEREUM_SENDER, selectSender, SENDER, UNLISTED_TOKEN } =
    await import('./__fixtures__/ethereum-send')

// 25 UNL in base units.
const HELD_BASE_UNITS = 25_000_000n
const UNLISTED_CAIP19 = `eip155:1/erc20:${UNLISTED_TOKEN.toLowerCase()}`

// No ether: a token alone must not count as funds once flagged.
const serveChain = () =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: RPC_URL,
            responses: {
                eth_call: erc20CallResponder({
                    [UNLISTED_TOKEN]: {
                        name: 'Unlisted Token',
                        symbol: 'UNL',
                        decimals: 6,
                        totalSupply: 1_000_000_000_000n,
                        balances: { [SENDER]: HELD_BASE_UNITS },
                    },
                }),
            },
        }),
    )

// The backend withholds a quarantined token's metadata but keeps its tier.
const serveQuarantined = () =>
    server.use(
        ...peraEvmHandlers({
            assets: {
                [UNLISTED_CAIP19]: {
                    ...unknownAssetItem(UNLISTED_CAIP19),
                    verification_tier: 'suspicious',
                },
            },
        }),
    )

const renderAddAsset = () =>
    renderWithNavigation(
        () => <AddAssetView chainId={ETH_SCOPE.chainId} />,
        'AddAsset',
    )

const addByContract = async (sheetTestID: string) => {
    renderAddAsset()
    fireEvent.change(
        await screen.findByPlaceholderText('add_asset.search_placeholder_evm'),
        { target: { value: UNLISTED_TOKEN } },
    )
    fireEvent.click(
        await screen.findByTestId(
            `asset_search_item_add_${UNLISTED_TOKEN}`,
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        ),
    )
    await screen.findByTestId(sheetTestID)
    fireEvent.click(screen.getByTestId('add_asset_unverified_token_confirm'))
}

const heldAmountOf = async (assetId: string) =>
    (
        await getAccountHoldings({ accountAddress: SENDER, scope: ETH_SCOPE })
    ).find(holding => holding.assetId === assetId)?.amount

// The state the add leaves behind, reached through the same metadata and
// account reads the background sync makes.
const seedHeldUnlistedToken = async () => {
    await fetchAndPersistAssets([UNLISTED_TOKEN], ETH_SCOPE)
    await addAccountToken({
        accountAddress: SENDER,
        scope: ETH_SCOPE,
        assetId: UNLISTED_TOKEN,
    })
    await fetchAndPersistAccount(SENDER, ETH_SCOPE)
}

describe("Flow: an Ethereum account holding a token Pera doesn't list", () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().resetState()
        useBottomSheetStore.getState().resetState()
        selectSender(ETHEREUM_SENDER)
        server.use(...peraEvmHandlers())
        serveChain()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('Given the account holds an unlisted token, when the user pastes its contract in Add Asset and accepts the unverified warning, then the token is added with its balance and offers no Remove', async () => {
        await addByContract('add_asset_unverified_token_sheet')

        await waitFor(
            async () =>
                expect(await heldAmountOf(UNLISTED_TOKEN)).toEqual(
                    new Decimal(HELD_BASE_UNITS.toString()),
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        // What Add Asset reads to decide Remove: only a token holding nothing offers it.
        expect(
            await getAccountAddedTokens({
                sources: [{ address: SENDER, scope: ETH_SCOPE }],
            }),
        ).toEqual([
            { scope: ETH_SCOPE, assetId: UNLISTED_TOKEN, hasBalance: true },
        ])
        const stored = await getAssetById({
            assetId: UNLISTED_TOKEN,
            scope: ETH_SCOPE,
        })
        expect(stored?.unitName).toBe('UNL')
        // Read the way the asset rows read it: no tier is unverified.
        expect(
            stored?.peraMetadata?.verificationTier ??
                PeraAssetVerificationTier.unverified,
        ).toBe(PeraAssetVerificationTier.unverified)
    })

    it('Given the unlisted token is added and held, when the send asset picker opens, then it lists the token with its balance', async () => {
        await seedHeldUnlistedToken()
        useSendFundsStore.getState().setChainId(ETH_SCOPE.chainId)

        renderWithNavigation(AssetSelectionScreen, 'AssetSelection')

        const row = await screen.findByTestId(
            `asset-list-item-${UNLISTED_TOKEN}`,
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        // The unit is its own element beside the amount, so it shows twice
        // (subtitle and amount) and the amount is the second.
        expect(within(row).getAllByText(/UNL/)).toHaveLength(2)
        expect(within(row).getByText(/25/)).toBeTruthy()
    })

    it("Given the pasted token is one Pera quarantined, when the user adds it past the suspicious warning, then it stays suspicious and doesn't count as funds", async () => {
        serveQuarantined()

        await addByContract('add_asset_suspicious_token_sheet')

        await waitFor(
            async () =>
                expect(await heldAmountOf(UNLISTED_TOKEN)).toEqual(
                    new Decimal(HELD_BASE_UNITS.toString()),
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            (await getAssetById({ assetId: UNLISTED_TOKEN, scope: ETH_SCOPE }))
                ?.peraMetadata?.verificationTier,
        ).toBe(PeraAssetVerificationTier.suspicious)
        expect(
            await getAccountFundedNetworks({
                accountAddress: SENDER,
                chainId: ETH_SCOPE.chainId,
            }),
        ).not.toContain(ETH_SCOPE.networkId)
    })
})
