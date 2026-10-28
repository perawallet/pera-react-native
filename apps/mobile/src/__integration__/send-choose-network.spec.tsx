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
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useSendFundsStore } from '@modules/transactions'
import { useReceiveFundsStore } from '@modules/transactions/hooks/receive-funds/useReceiveFunds'
import { SendFundsRoutes } from '@modules/transactions/routes/send-funds'
import {
    ETH_USDC,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'
import { USDC_TEST_ASSET } from './__fixtures__/assets'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const ALGORAND_ONLY_ACCOUNT: WalletAccount = {
    id: 'algorand-only',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'a-key' },
    },
    name: 'Algorand only',
}

const selectAccount = (account: WalletAccount) => {
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
}

const renderSend = () => renderWithNavigation(SendFundsRoutes, 'SendFunds')

const typeIntoSearch = (text: string) => {
    // The sticky mirror renders first; the focusable field is the last.
    const fields = screen.getAllByPlaceholderText(
        'send_funds.asset_selection.search_placeholder',
    )
    fireEvent.change(fields[fields.length - 1], { target: { value: text } })
}

describe('Flow: Send starts on the network the user chooses', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useRemoteConfigStore.getState().resetState()
        useSendFundsStore.getState().reset()
        useReceiveFundsStore.getState().reset()
        useBottomSheetStore.getState().resetState()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    describe('Given an account on Algorand and Ethereum holding assets on both', () => {
        beforeEach(async () => {
            await seedHoldings()
            selectAccount(TWO_CHAIN_ACCOUNT)
        })

        it('When Send opens, then it asks for the network before any asset', () => {
            renderSend()

            expect(screen.getByTestId('send_chain_row_algorand')).toBeTruthy()
            expect(screen.getByTestId('send_chain_row_ethereum')).toBeTruthy()
            expect(screen.queryByTestId('asset-list-item-0')).toBeNull()
        })

        it('When the user picks Ethereum, then only Ethereum holdings are listed', async () => {
            renderSend()

            fireEvent.click(screen.getByTestId('send_chain_row_ethereum'))

            expect(
                await screen.findByTestId(`asset-list-item-${ETH_USDC}`),
            ).toBeTruthy()
            expect(useSendFundsStore.getState().chainId).toBe('ethereum')
            expect(screen.queryByTestId('asset-list-item-0')).toBeNull()
            expect(
                screen.queryByTestId(
                    `asset-list-item-${USDC_TEST_ASSET.assetId}`,
                ),
            ).toBeNull()
        })

        it('When the user picks Algorand, then only Algorand holdings are listed', async () => {
            renderSend()

            fireEvent.click(screen.getByTestId('send_chain_row_algorand'))

            expect(await screen.findByTestId('asset-list-item-0')).toBeTruthy()
            expect(
                screen.getByTestId(
                    `asset-list-item-${USDC_TEST_ASSET.assetId}`,
                ),
            ).toBeTruthy()
            expect(
                screen.queryByTestId(`asset-list-item-${ETH_USDC}`),
            ).toBeNull()
        })

        it('When the send already names its asset, then neither picker shows', () => {
            useSendFundsStore
                .getState()
                .setSelectedAsset({ chainId: 'ethereum', assetId: ETH_USDC })
            useSendFundsStore.getState().setCanSelectAsset(false)

            renderSend()

            expect(screen.queryByTestId('send_chain_row_ethereum')).toBeNull()
            expect(
                screen.queryByTestId(`asset-list-item-${ETH_USDC}`),
            ).toBeNull()
        })
    })

    it('Given an account on Algorand alone, when Send opens, then it goes straight to its assets', async () => {
        await seedHoldings()
        selectAccount(ALGORAND_ONLY_ACCOUNT)

        renderSend()

        expect(await screen.findByTestId('asset-list-item-0')).toBeTruthy()
        expect(screen.queryByTestId('send_chain_row_algorand')).toBeNull()
    })

    describe('Given an account with nothing on Ethereum', () => {
        beforeEach(() => {
            selectAccount(TWO_CHAIN_ACCOUNT)
        })

        it('When the user picks Ethereum, then it says there is nothing to send there and offers Receive on Ethereum', async () => {
            renderSend()

            fireEvent.click(screen.getByTestId('send_chain_row_ethereum'))

            expect(
                await screen.findByTestId('send_asset_empty_state'),
            ).toBeTruthy()
            expect(
                screen.getByText('send_funds.asset_selection.empty_title'),
            ).toBeTruthy()

            fireEvent.click(screen.getByTestId('send_empty_receive_button'))

            const receive = useReceiveFundsStore.getState()
            expect(receive.selectedAccount?.id).toBe(TWO_CHAIN_ACCOUNT.id)
            expect(receive.chainId).toBe('ethereum')
            expect(receive.canSelectAccount).toBe(false)
            await waitFor(() =>
                expect(
                    useBottomSheetStore.getState().requests.some(
                        request =>
                            (request.contents as { props?: unknown }).props !==
                                undefined &&
                            (
                                request.contents as {
                                    props: { chainId?: string }
                                }
                            ).props.chainId === 'ethereum',
                    ),
                ).toBe(true),
            )
        })

        it('When the user searches with no match, then it says no assets match rather than nothing to send', async () => {
            renderSend()
            fireEvent.click(screen.getByTestId('send_chain_row_ethereum'))
            await screen.findByTestId('send_asset_empty_state')

            typeIntoSearch('nothing-matches')

            expect(
                await screen.findByText(
                    'send_funds.asset_selection.no_results_title',
                ),
            ).toBeTruthy()
            expect(screen.queryByTestId('send_asset_empty_state')).toBeNull()
        })
    })
})
