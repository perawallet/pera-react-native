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

// Before an Ethereum send is confirmed, the recipient is checked against the
// addresses the wallet knows: its own accounts, its contacts, and the
// counterparties its Pera history shows real value moving with. A look-alike
// holds Confirm until acknowledged; an unknown address only gets a notice.
// Copy is asserted by key: this project renders i18n keys.

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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { EvmHistoryItemResponse } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { server } from '@test-utils/msw-server'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof withBackend.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
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
const { fireEvent, screen, waitFor } = await import('@testing-library/react')
const { Decimal } = await import('decimal.js')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { SeedScheme } = await import('@perawallet/wallet-core-kms')
const { nativeAssetFor, upsertAssetPrices, upsertAssets } =
    await import('@perawallet/wallet-core-assets')
const { addressCodecs } = await import('@perawallet/wallet-core-chain-contract')
const { useContactsStore } = await import('@perawallet/wallet-core-contacts')
const { evmHistoryItem, evmRpcHandlers } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { isElementDisabled } = await import('@test-utils/rnw')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { useSendFundsStore } = await import('@modules/transactions')
const { TransactionConfirmationScreen } =
    await import('@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen')
const { SelectDestinationScreen } =
    await import('@modules/transactions/screens/send-funds/SelectDestinationScreen/SelectDestinationScreen')

const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

// Hardhat accounts #0 to #4, from the public test mnemonic.
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const CONTACT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const PAYEE = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const POISONER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const STRANGER = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'

// Same `0x1234...abcd` short form as the address it copies, different middle.
const lookAlikeOf = (address: string, filler: string) =>
    `${address.slice(0, 6)}${filler.repeat(32)}${address.slice(-4)}`.toLowerCase()

const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: {
        kind: 'local',
        seed: SeedScheme.Bip39,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: 'eth-key' } },
    name: 'Eth sender',
}

const hashOf = (n: number) => `0x${String(n).padStart(64, '0')}`

const sentToPayee: EvmHistoryItemResponse = evmHistoryItem({
    hash: hashOf(1),
    from: SENDER.toLowerCase(),
    to: PAYEE.toLowerCase(),
    value: '500000000000000000',
})

const zeroValueFromPoisoner: EvmHistoryItemResponse = evmHistoryItem({
    hash: hashOf(2),
    from: POISONER.toLowerCase(),
    to: SENDER.toLowerCase(),
    value: '0',
})

// A poisoner who paid a real amount to look known.
const PAYING_POISONER = lookAlikeOf(CONTACT, '5')
const paidByPoisoner: EvmHistoryItemResponse = evmHistoryItem({
    hash: hashOf(3),
    from: PAYING_POISONER,
    to: SENDER.toLowerCase(),
    value: '1000000000000000000',
})

const normalize = (address: string) =>
    addressCodecs.get('ethereum').normalize(address)

const prefillSend = (destination: string) => {
    useSendFundsStore
        .getState()
        .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })
    useSendFundsStore.getState().setAmount(new Decimal('0.1'))
    useSendFundsStore.getState().setDestination(destination)
    useSendFundsStore.getState().setSendMode('normal')
}

const renderConfirmation = (destination: string) => {
    prefillSend(destination)
    renderWithNavigation(TransactionConfirmationScreen, 'ConfirmTransaction')
}

const confirmButton = () =>
    screen.findByTestId('send_confirm_button', undefined, {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })

const findLookAlikeWarning = () =>
    screen.findByTestId('recipient_look_alike_warning', undefined, {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })

const findFirstSendNotice = () =>
    screen.findByTestId('recipient_first_send_notice', undefined, {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })

describe('Flow: warn before sending to a look-alike on Ethereum', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        const ether = nativeAssetFor('ethereum')
        await upsertAssets({ items: [ether], scope: ETH_SCOPE })
        await upsertAssetPrices({
            prices: [{ assetId: ether.assetId, usdPrice: new Decimal(3000) }],
            scope: ETH_SCOPE,
        })
        useAccountsStore.getState().setAccounts([ETHEREUM_SENDER])
        useAccountsStore.getState().setSelectedAccountId(ETHEREUM_SENDER.id)
        useContactsStore.setState({
            contacts: [
                { id: 'alice', name: 'Alice', addresses: { evm: CONTACT } },
            ],
        })
        useSendFundsStore.getState().reset()
        server.use(
            ...evmRpcHandlers({ rpcUrl: RPC_URL }),
            ...peraEvmHistoryHandlers({
                history: {
                    [SENDER.toLowerCase()]: [
                        [paidByPoisoner, zeroValueFromPoisoner, sentToPayee],
                    ],
                },
            }),
        )
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useContactsStore.setState({ contacts: [] })
        useSendFundsStore.getState().reset()
    })

    it("Given a look-alike of a contact, when the send reaches confirmation, then both full addresses show and Confirm waits for the user's acknowledgement", async () => {
        const lookAlike = lookAlikeOf(CONTACT, '0')

        renderConfirmation(lookAlike)

        await findLookAlikeWarning()
        expect(
            screen.getByTestId('recipient_look_alike_recipient_address')
                .textContent,
        ).toBe(normalize(lookAlike))
        expect(
            screen.getByTestId('recipient_look_alike_known_address')
                .textContent,
        ).toBe(normalize(CONTACT))
        expect(isElementDisabled(await confirmButton())).toBe(true)

        fireEvent.click(screen.getByTestId('recipient_look_alike_acknowledge'))

        await waitFor(async () =>
            expect(isElementDisabled(await confirmButton())).toBe(false),
        )
    })

    it('Given a look-alike of an address the account sent to before, on a fresh install, when the send reaches confirmation, then it warns', async () => {
        renderConfirmation(lookAlikeOf(PAYEE, '1'))

        await findLookAlikeWarning()
        expect(
            screen.getByTestId('recipient_look_alike_known_address')
                .textContent,
        ).toBe(normalize(PAYEE))
        expect(isElementDisabled(await confirmButton())).toBe(true)
    })

    it('Given a look-alike of the account itself, when the send reaches confirmation, then it warns', async () => {
        renderConfirmation(lookAlikeOf(SENDER, '2'))

        await findLookAlikeWarning()
        expect(
            screen.getByTestId('recipient_look_alike_known_address')
                .textContent,
        ).toBe(normalize(SENDER))
    })

    it('Given an address that only ever sent the account a zero-value transfer, when a look-alike of it is the recipient, then it is not trusted and only the first-send notice shows', async () => {
        renderConfirmation(lookAlikeOf(POISONER, '3'))

        await findFirstSendNotice()
        expect(screen.queryByTestId('recipient_look_alike_warning')).toBeNull()
        expect(isElementDisabled(await confirmButton())).toBe(false)
    })

    it('Given a look-alike of a contact that paid the account a real amount, when the send reaches confirmation, then it still warns', async () => {
        renderConfirmation(PAYING_POISONER)

        await findLookAlikeWarning()
        expect(
            screen.getByTestId('recipient_look_alike_known_address')
                .textContent,
        ).toBe(normalize(CONTACT))
        expect(isElementDisabled(await confirmButton())).toBe(true)
    })

    it('Given an address resembling nothing known, when the send reaches confirmation, then the first-send notice shows and Confirm stays enabled', async () => {
        renderConfirmation(STRANGER)

        await findFirstSendNotice()
        await waitFor(async () =>
            expect(isElementDisabled(await confirmButton())).toBe(false),
        )
        expect(screen.getByText(STRANGER)).toBeTruthy()
    })

    it.each([
        ['a contact, in another letter case', CONTACT.toLowerCase()],
        ['a previous recipient', PAYEE],
    ])(
        'Given %s, when the send reaches confirmation, then neither warning shows',
        async (_, recipient) => {
            renderConfirmation(recipient)

            await waitFor(async () =>
                expect(isElementDisabled(await confirmButton())).toBe(false),
            )
            expect(
                screen.queryByTestId('recipient_look_alike_warning'),
            ).toBeNull()
            expect(
                screen.queryByTestId('recipient_first_send_notice'),
            ).toBeNull()
        },
    )

    it('Given a look-alike typed into the recipient picker, when the user picks it, then it becomes the destination the confirmation checks', async () => {
        const lookAlike = lookAlikeOf(CONTACT, '4')
        prefillSend(lookAlike)
        // Nothing prefilled, so the picker shows instead of auto-advancing.
        useSendFundsStore.getState().setDestination(undefined)
        renderWithNavigation(SelectDestinationScreen, 'SelectDestination')

        // The field's wrapper carries the test id too; type into the input.
        const inputs = (
            await screen.findAllByTestId('address_search_input')
        ).filter(element => element.tagName === 'INPUT')
        for (const input of inputs) {
            fireEvent.change(input, { target: { value: lookAlike } })
        }
        fireEvent.click(
            await screen.findByText(
                addressCodecs.get('ethereum').truncate(lookAlike),
            ),
        )

        await waitFor(() =>
            expect(useSendFundsStore.getState().destination).toBe(lookAlike),
        )
    })
})
