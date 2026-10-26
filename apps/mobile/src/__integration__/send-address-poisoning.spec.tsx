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
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'
import { Text } from 'react-native'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    seedAssets,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { isElementDisabled } from '@test-utils/rnw'
import {
    insertAssetHolding,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import {
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { mockAlgodAccountInformation } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { EMPTY_ALGORAND_HISTORY_DATA } from '@perawallet/wallet-core-chain-algorand/transactions'
import { useSendFundsStore } from '@modules/transactions'
import { SelectDestinationScreen } from '@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { USDC_TEST_ASSET, USDC_TEST_ASSET_ID } from './__fixtures__/assets'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

const CONTACT_ADDRESS = HD_TEST_ADDRESS
// Checksum-valid, and shares its first 17 characters with CONTACT_ADDRESS.
const LOOKALIKE_ADDRESS =
    'RP35URKAEVP6PA3WDALGSWJ7SDAQLIWFTT5ZPEJ4TDLV72T326BSXWD6O4'
const DUSTER_ADDRESS =
    'BMYFK6U7YTUQ4M2YPWRMP3ARGZNYBJOK54KDSXUDVDG7EFZ4MGDOOTKZLM'

const SENDER: WalletAccount = {
    id: 'sender-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'sender-key' },
    },
    name: 'Sender',
}

const DUST_PAYMENT: TransactionHistoryItem = {
    id: 'TXDUST000000000000000000000000000000000000000000000001',
    txType: 'pay',
    sender: DUSTER_ADDRESS,
    receiver: ALGO25_TEST_ADDRESS,
    assetSender: null,
    confirmedRound: 100,
    roundTime: 1_700_000_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(1),
    asset: null,
    balanceImpacts: [],
}

// Pays nothing directly but sweeps its whole balance into the sender, so it
// is a real transfer, not dust.
const CLOSE_OUT: TransactionHistoryItem = {
    ...DUST_PAYMENT,
    id: 'TXCLOSE00000000000000000000000000000000000000000000001',
    amount: new Decimal(0),
    chainData: {
        ...EMPTY_ALGORAND_HISTORY_DATA,
        closeTo: ALGO25_TEST_ADDRESS,
        closeAmount: new Decimal(5_000_000),
    },
}

const ConfirmStub = () => <Text>confirm-transaction-screen</Text>

const addContact = (address: string) => {
    const { result } = renderHook(() => useContacts())
    result.current.addContact({
        name: 'Alice',
        addresses: { algorand: address },
    })
}

const resetContacts = () => {
    const { result } = renderHook(() => useContacts())
    for (const contact of result.current.contacts) {
        result.current.deleteContact(contact.id)
    }
}

const prefillSend = (assetId: string, destination: string) => {
    useSendFundsStore
        .getState()
        .setSelectedAsset({ chainId: 'algorand', assetId })
    useSendFundsStore.getState().setAmount(new Decimal(1))
    useSendFundsStore.getState().setDestination(destination)
}

const renderDestinationStep = () =>
    renderWithNavigation(SelectDestinationScreen, 'SelectDestination', {
        additionalScreens: [
            { name: 'ConfirmTransaction', component: ConfirmStub },
        ],
    })

// The sheet re-renders the button, so always read the live node.
const continueButton = () => screen.getByTestId('address_poisoning_continue')

const isOnConfirm = () =>
    screen.queryByText('confirm-transaction-screen') !== null

describe('Flow: warn before sending to a poisoned address', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        await seedAssets([USDC_TEST_ASSET], 'mainnet')
        useAccountsStore.getState().setAccounts([SENDER])
        useAccountsStore.getState().setSelectedAccountId(SENDER.id)
        useSendFundsStore.getState().reset()
        resetContacts()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it('Given a contact, when the user sends ALGO to a look-alike of it, then the warning shows both full addresses and keeps Continue disabled until the user confirms they checked', async () => {
        addContact(CONTACT_ADDRESS)
        prefillSend('0', LOOKALIKE_ADDRESS)

        renderDestinationStep()

        await waitFor(() =>
            expect(
                screen.getByTestId('address_poisoning_warning'),
            ).toBeTruthy(),
        )
        expect(
            screen.getByTestId('address_poisoning_recipient').textContent,
        ).toBe(LOOKALIKE_ADDRESS)
        expect(
            screen.getByTestId('address_poisoning_similar_to').textContent,
        ).toBe(CONTACT_ADDRESS)
        expect(isElementDisabled(continueButton())).toBe(true)

        fireEvent.click(screen.getByTestId('address_poisoning_acknowledge'))
        await waitFor(() =>
            expect(isElementDisabled(continueButton())).toBe(false),
        )
        fireEvent.click(continueButton())

        await waitFor(() => expect(isOnConfirm()).toBe(true))
        expect(useSendFundsStore.getState().destination).toBe(LOOKALIKE_ADDRESS)
    })

    it('Given the look-alike warning, when the user cancels, then the receiver is cleared and the send stays on the picker', async () => {
        addContact(CONTACT_ADDRESS)
        prefillSend('0', LOOKALIKE_ADDRESS)

        renderDestinationStep()

        await waitFor(() =>
            expect(screen.getByTestId('address_poisoning_cancel')).toBeTruthy(),
        )
        fireEvent.click(screen.getByTestId('address_poisoning_cancel'))

        await waitFor(() =>
            expect(useSendFundsStore.getState().destination).toBeUndefined(),
        )
        expect(isOnConfirm()).toBe(false)
    })

    it('Given an address that only sent the user 1 base unit of ALGO, when the user sends an ASA to it, then the dust warning shows and confirming continues the send', async () => {
        await upsertTransactions({
            items: [DUST_PAYMENT],
            accountAddress: ALGO25_TEST_ADDRESS,
            scope: MAINNET_SCOPE,
        })
        await insertAssetHolding({
            accountAddress: ALGO25_TEST_ADDRESS,
            assetId: USDC_TEST_ASSET_ID,
            scope: MAINNET_SCOPE,
            amount: new Decimal('10000000'),
        })
        await seedAlgorandAccountState({
            accountAddress: ALGO25_TEST_ADDRESS,
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 1,
            minBalance: new Decimal(200_000),
        })
        server.use(
            mockAlgodAccountInformation({
                address: DUSTER_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 200_000,
                    assets: [
                        {
                            'asset-id': Number(USDC_TEST_ASSET_ID),
                            amount: 0,
                            'is-frozen': false,
                        },
                    ],
                },
            }),
        )
        prefillSend(USDC_TEST_ASSET_ID, DUSTER_ADDRESS)

        renderDestinationStep()

        await waitFor(() =>
            expect(
                screen.getByTestId('address_poisoning_warning'),
            ).toBeTruthy(),
        )
        expect(screen.queryByTestId('address_poisoning_similar_to')).toBeNull()
        expect(
            screen.getByTestId('address_poisoning_recipient').textContent,
        ).toBe(DUSTER_ADDRESS)

        fireEvent.click(screen.getByTestId('address_poisoning_acknowledge'))
        await waitFor(() =>
            expect(isElementDisabled(continueButton())).toBe(false),
        )
        fireEvent.click(continueButton())

        await waitFor(() => expect(isOnConfirm()).toBe(true))
    })

    it('Given an address that closed its account into the user, when the user sends ALGO to it, then no dust warning shows', async () => {
        await upsertTransactions({
            items: [CLOSE_OUT],
            accountAddress: ALGO25_TEST_ADDRESS,
            scope: MAINNET_SCOPE,
        })
        prefillSend('0', DUSTER_ADDRESS)

        renderDestinationStep()

        await waitFor(() => expect(isOnConfirm()).toBe(true))
        expect(screen.queryByTestId('address_poisoning_warning')).toBeNull()
    })

    it("Given a contact, when the user sends to the contact's exact address, then the send goes straight to confirmation with no warning", async () => {
        addContact(CONTACT_ADDRESS)
        prefillSend('0', CONTACT_ADDRESS)

        renderDestinationStep()

        await waitFor(() => expect(isOnConfirm()).toBe(true))
        expect(screen.queryByTestId('address_poisoning_warning')).toBeNull()
    })
})
