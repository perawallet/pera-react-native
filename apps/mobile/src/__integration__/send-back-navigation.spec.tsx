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

// Back and close in the send sheet: every back pops one screen, the first
// screen has no back, and the X leaves the whole flow, asking first once the
// user has entered something.

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
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { UserPreferences } from '@constants/user-preferences'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useSendFundsStore } from '@modules/transactions'
import { SendFundsRoutes } from '@modules/transactions/routes/send-funds'
import {
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'

const RPC_URL = 'https://mainnet.rpc.test/'

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

const ETHER = 'native'
const RECIPIENT_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const RECIPIENT_ACCOUNT: WalletAccount = {
    id: 'recipient',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: RECIPIENT_ADDRESS, keyPairId: 'r-key' } },
    name: 'Recipient',
}

const onFinished = vi.fn()

const renderSend = () => renderWithNavigation(SendFundsRoutes, 'SendFunds')

const pressBack = () =>
    fireEvent.click(screen.getByTestId('navigation_back_button'))

const pressClose = () =>
    fireEvent.click(screen.getByTestId('send_close_button'))

const recipientRow = () =>
    screen.findByTestId(`account_result_row_${RECIPIENT_ADDRESS}`)

const REVIEW = 'send_confirm_button'

describe('Flow: stepping back through and closing the send flow', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedHoldings()
        server.use(...evmRpcHandlers({ rpcUrl: RPC_URL }))
        useRemoteConfigStore.getState().resetState()
        useSettingsStore.getState().resetState()
        useSettingsStore
            .getState()
            .setPreference(UserPreferences.transactionInfoAgreed, true)
        useAccountsStore
            .getState()
            .setAccounts([TWO_CHAIN_ACCOUNT, RECIPIENT_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(TWO_CHAIN_ACCOUNT.id)
        useSendFundsStore.getState().reset()
        useSendFundsStore.getState().setOnFinished(onFinished)
        useBottomSheetStore.getState().resetState()
        onFinished.mockClear()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an ether send taken to review, when the user backs out screen by screen, then each back pops one screen and the first screen closes the flow', async () => {
        renderSend()
        fireEvent.click(screen.getByTestId('send_chain_row_ethereum'))
        fireEvent.click(await screen.findByTestId(`asset-list-item-${ETHER}`))
        await screen.findByTestId('send_input_amount')
        fireEvent.click(screen.getByTestId('numpad_key_1'))
        fireEvent.click(screen.getByTestId('send_input_next_button'))
        fireEvent.click(await recipientRow())
        await screen.findByTestId(REVIEW, undefined, { timeout: 5000 })

        // The harness mounts only the top screen, so going back remounts the
        // picker, which would treat a stored recipient as an opener's prefill
        // and advance again. The app keeps the picker mounted underneath.
        useSendFundsStore.getState().setDestination(undefined)
        pressBack()
        await recipientRow()
        expect(screen.queryByTestId(REVIEW)).toBeNull()

        pressBack()
        await screen.findByTestId('send_input_amount')
        // The recipient went with the picker, so Next asks again.
        fireEvent.click(screen.getByTestId('send_input_next_button'))
        await recipientRow()
        expect(screen.queryByTestId(REVIEW)).toBeNull()

        pressBack()
        await screen.findByTestId('send_input_amount')
        pressBack()
        await screen.findByTestId(`asset-list-item-${ETHER}`)
        expect(screen.queryByTestId('send_input_amount')).toBeNull()

        pressBack()
        await screen.findByTestId('send_chain_row_ethereum')
        expect(screen.queryByTestId('navigation_back_button')).toBeNull()

        pressClose()

        expect(onFinished).toHaveBeenCalledTimes(1)
        expect(useBottomSheetStore.getState().requests).toHaveLength(0)
    })

    it('Given a send started from an asset, when the amount screen opens, then it has no back and its X closes the flow', async () => {
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: ETHER })
        useSendFundsStore.getState().setCanSelectAsset(false)

        renderSend()
        await screen.findByTestId('send_input_amount')

        expect(screen.queryByTestId('navigation_back_button')).toBeNull()
        pressClose()
        expect(onFinished).toHaveBeenCalledTimes(1)
    })

    describe('Given an amount typed on the amount screen', () => {
        beforeEach(async () => {
            useSendFundsStore
                .getState()
                .setSelectedAsset({ chainId: 'ethereum', assetId: ETHER })
            useSendFundsStore.getState().setCanSelectAsset(false)
            renderSend()
            await screen.findByTestId('send_input_amount')
            fireEvent.click(screen.getByTestId('numpad_key_1'))
            pressClose()
            await screen.findByTestId('send_discard_sheet')
        })

        it('When the user cancels the discard, then the flow stays open', async () => {
            fireEvent.click(screen.getByTestId('send_discard_cancel'))

            await waitFor(() =>
                expect(screen.queryByTestId('send_discard_sheet')).toBeNull(),
            )
            expect(screen.getByTestId('send_input_amount')).toBeTruthy()
            expect(onFinished).not.toHaveBeenCalled()
        })

        it('When the user confirms the discard, then the flow closes', async () => {
            expect(onFinished).not.toHaveBeenCalled()

            fireEvent.click(screen.getByTestId('send_discard_confirm'))

            await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
        })
    })
})
