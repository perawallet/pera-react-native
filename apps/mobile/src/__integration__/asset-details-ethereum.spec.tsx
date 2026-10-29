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
import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    erc20CallResponder,
    evmRpcHandlers,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { AssetDetailsScreen } from '@modules/assets/screens/AssetDetailsScreen'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useReceiveFundsStore } from '@modules/transactions/hooks/receive-funds/useReceiveFunds'
import { useSendFundsStore } from '@modules/transactions'
import { USDC_TEST_ASSET } from './__fixtures__/assets'
import {
    ETH_USDC,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const RPC_URL = 'https://mainnet.rpc.test/'

// The integration setup registers whichever chains config enables, and hands
// each chain the endpoints config gives it.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
                : actual.chainEndpointsFor(chainId),
    }
})

const CHECKSUMMED_ETH_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'algo-only',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
    },
    name: 'Algo only',
}

const selectAccount = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const renderDetails = (params: { assetId: string; chainId: string }) =>
    renderWithNavigation(AssetDetailsScreen, 'AssetDetails', {
        initialParams: params,
    })

describe('Flow: Asset details on its own network', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useReceiveFundsStore.getState().reset()
        useSendFundsStore.getState().resetState()
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        await seedHoldings()
    })

    afterEach(() => {
        useReceiveFundsStore.getState().reset()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an account on Algorand and Ethereum, when an Ethereum token opens, then both tabs name the Ethereum network', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)

        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        const lines = await screen.findAllByTestId('chain_label_ethereum')
        expect(lines).toHaveLength(2)
        expect(lines[0].textContent).toContain(
            'account_details.assets.chain_network',
        )
        expect(screen.queryAllByTestId('chain_label_algorand')).toHaveLength(0)
    })

    it('Given an Ethereum token, when Receive is pressed, then the Ethereum QR opens directly', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        fireEvent.click(
            await screen.findByTestId('asset_detail_receive_button'),
        )
        await waitFor(() =>
            expect(useBottomSheetStore.getState().requests).toHaveLength(1),
        )
        // The sheet picks its first screen on its first render, so the store must hold the pin before it mounts.
        expect(useReceiveFundsStore.getState()).toMatchObject({
            canSelectAccount: false,
            chainId: 'ethereum',
            selectedAccount: { id: TWO_CHAIN_ACCOUNT.id },
        })

        const qr = (await screen.findByTestId('QRCode')) as HTMLElement
        expect(qr.getAttribute('value')).toBe(
            `ethereum:${CHECKSUMMED_ETH_ADDRESS}@1`,
        )
    })

    it('Given an Ethereum token, when Send is pressed, then the token is preselected on Ethereum', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        fireEvent.click(await screen.findByTestId('asset_detail_send_button'))

        expect(useSendFundsStore.getState().selectedAsset).toEqual({
            chainId: 'ethereum',
            assetId: ETH_USDC,
        })
    })

    it('Given an ERC-20, when its Markets tab renders, then it has no verification card and its explorer link is Etherscan', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        expect(
            await screen.findByText('asset_details.main_screen.markets_tab'),
        ).toBeTruthy()
        expect(await screen.findByText('etherscan.io')).toBeTruthy()
        expect(
            screen.queryByText(/asset_details\.verification_card\./),
        ).toBeNull()
    })

    it('Given ETH, when its Markets tab renders, then it shows a circulating supply with no figure and an explorer link', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: 'native', chainId: 'ethereum' })

        expect(
            await screen.findByText('asset_details.markets.circulating_supply'),
        ).toBeTruthy()
        expect(screen.getByText('—')).toBeTruthy()
        expect(
            screen.queryByText('asset_details.markets.total_supply'),
        ).toBeNull()
        expect(screen.getByText('etherscan.io')).toBeTruthy()
    })

    it("Given an ERC-20 whose stored supply is unknown, when its Markets tab renders, then it shows the contract's total supply", async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_call: erc20CallResponder({
                        [ETH_USDC]: {
                            name: 'USD Coin',
                            symbol: 'USDC',
                            decimals: 6,
                            totalSupply: 61_234_567_890_000_000n,
                        },
                    }),
                },
            }),
        )
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        expect(
            await screen.findByText('asset_details.markets.total_supply'),
        ).toBeTruthy()
        expect(await screen.findByText('61.23B')).toBeTruthy()
        expect(
            screen.getByText('asset_details.collectible.contract'),
        ).toBeTruthy()
        expect(
            screen.queryByText('asset_details.markets.circulating_supply'),
        ).toBeNull()
    })

    it('Given an ERC-20 whose contract cannot be read, when its Markets tab renders, then the supply reads —', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: { eth_call: erc20CallResponder({}) },
            }),
        )
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        expect(
            await screen.findByText('asset_details.markets.total_supply'),
        ).toBeTruthy()
        expect(screen.getByText('—')).toBeTruthy()
    })

    it('Given an Ethereum token, when its tabs render, then both show a chart and neither shows an unavailable notice', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        expect(
            await screen.findAllByTestId('chain_label_ethereum'),
        ).toHaveLength(2)
        expect(screen.getAllByText('chart.one_week.label')).toHaveLength(2)
        expect(
            screen.queryByText('common.network_unavailable.title'),
        ).toBeNull()
    })

    it('Given an Ethereum token, when its details open, then neither tab shows the price-alert or favorite button', async () => {
        selectAccount(TWO_CHAIN_ACCOUNT)
        renderDetails({ assetId: ETH_USDC, chainId: 'ethereum' })

        expect(
            await screen.findAllByTestId('chain_label_ethereum'),
        ).toHaveLength(2)
        expect(
            screen.queryAllByTestId('asset_notification_button'),
        ).toHaveLength(0)
        expect(screen.queryAllByTestId('asset_favorite_button')).toHaveLength(0)
    })

    it('Given an Algorand asset, when its details open, then the price-alert and favorite buttons show', async () => {
        selectAccount(ALGORAND_ACCOUNT)
        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        expect(
            await screen.findAllByTestId('asset_notification_button'),
        ).toHaveLength(2)
        expect(
            await screen.findAllByTestId('asset_favorite_button'),
        ).toHaveLength(2)
    })

    it('Given an Algorand asset, when its tabs render, then both show a chart', async () => {
        selectAccount(ALGORAND_ACCOUNT)
        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        expect(await screen.findByTestId('asset_details_screen')).toBeTruthy()
        expect(screen.getAllByText('chart.one_week.label')).toHaveLength(2)
    })

    it('Given an Algorand asset, when its Markets tab renders, then it keeps the total supply and the ASA id', async () => {
        selectAccount(ALGORAND_ACCOUNT)
        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        expect(
            await screen.findByText('asset_details.markets.total_supply'),
        ).toBeTruthy()
        expect(screen.getByText('asset_details.about.asa_id')).toBeTruthy()
    })

    it('Given an account on Algorand alone, when an ASA opens, then no network line shows and both tabs remain', async () => {
        selectAccount(ALGORAND_ACCOUNT)
        renderDetails({
            assetId: USDC_TEST_ASSET.assetId,
            chainId: 'algorand',
        })

        expect(await screen.findByTestId('asset_details_screen')).toBeTruthy()
        expect(screen.queryAllByTestId(/^chain_label_/)).toHaveLength(0)
        expect(
            screen.getByText('asset_details.main_screen.holdings_tab'),
        ).toBeTruthy()
        expect(
            screen.getByText('asset_details.main_screen.markets_tab'),
        ).toBeTruthy()
    })
})
