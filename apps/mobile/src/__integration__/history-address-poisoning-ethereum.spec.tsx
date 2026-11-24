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

// A worthless transfer from a look-alike of a known address is marked in
// History, and pressing it opens the transaction's details under the same
// explanation. Copy is asserted by key: this project renders i18n keys.

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

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('@packages/chain-ethereum/src/__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal)
    return {
        ...withBackend,
        config: {
            ...withBackend.config,
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
// The setup's navigator mocks were first evaluated before the reset, so left
// alone a screen's `navigate` reaches nothing.
vi.doMock(
    '@react-navigation/native',
    () => import('@test-utils/test-navigator'),
)
vi.doMock('@react-navigation/native-stack', async () => ({
    createNativeStackNavigator: (await import('@test-utils/test-navigator'))
        .createNativeStackNavigator,
}))
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { fireEvent, screen, waitFor, within } =
    await import('@testing-library/react')
const { Decimal } = await import('decimal.js')
const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')
const { SeedScheme } = await import('@perawallet/wallet-core-kms')
const { nativeAssetFor, upsertAssetPrices, upsertAssets } =
    await import('@perawallet/wallet-core-assets')
const { addressCodecs } = await import('@perawallet/wallet-core-chain-contract')
const { useContactsStore } = await import('@perawallet/wallet-core-contacts')
const { evmHistoryItem } =
    await import('@perawallet/wallet-core-chain-ethereum/test-handlers')
const { peraEvmHistoryHandlers } =
    await import('@packages/chain-ethereum/src/history/api/msw-handlers')
const { renderWithNavigation } =
    await import('@test-utils/renderWithNavigation')
const { closestPressable } = await import('@test-utils/rnw')
const { resetTestDatabase, setupTestDatabase, teardownTestDatabase } =
    await import('@test-utils/database-setup')
const { AccountHistory } =
    await import('@modules/accounts/components/AccountHistory/AccountHistory')
const { TransactionDetailsScreen } = await import('@modules/signing/routes')

const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

// Hardhat accounts #0 to #2, from the public test mnemonic.
const ACCOUNT_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const CONTACT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const PAYEE = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

// Same `0x1234...abcd` short form as the address it copies, different middle.
const lookAlikeOf = (address: string, filler: string) =>
    `${address.slice(0, 6)}${filler.repeat(32)}${address.slice(-4)}`.toLowerCase()

const ACCOUNT: WalletAccount = {
    id: 'eth-account',
    custody: {
        kind: 'local',
        seed: SeedScheme.Bip39,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: ACCOUNT_ADDRESS, keyPairId: 'eth-key' } },
    name: 'Eth account',
}

const hashOf = (n: number) => `0x${String(n).padStart(64, '0')}`
const ME = ACCOUNT_ADDRESS.toLowerCase()

const transfer = (
    n: number,
    from: string,
    to: string,
    value: string,
): EvmHistoryItemResponse =>
    evmHistoryItem({
        hash: hashOf(n),
        block_time: `2026-01-0${n}T00:00:00Z`,
        from,
        to,
        value,
    })

const ZERO_FROM_CONTACT_LOOK_ALIKE = transfer(
    4,
    lookAlikeOf(CONTACT, '0'),
    ME,
    '0',
)
const DUST_FROM_PAYEE_LOOK_ALIKE = transfer(3, lookAlikeOf(PAYEE, '1'), ME, '1')
const REAL_FROM_CONTACT_LOOK_ALIKE = transfer(
    2,
    lookAlikeOf(CONTACT, '5'),
    ME,
    '1000000000000000000',
)
const SENT_TO_PAYEE = transfer(1, ME, PAYEE.toLowerCase(), '500000000000000000')

// A row known only from its token log: the backend names no signer for it.
const UNSIGNED_UNKNOWN_TOKEN_TO_CONTACT_LOOK_ALIKE = (() => {
    const token = '0x0000000000000000000000000000000000000c0c'
    return evmHistoryItem({
        hash: hashOf(5),
        block_time: '2026-01-05T00:00:00Z',
        token_transfers: [
            {
                asset_id: `eip155:1/erc20:${token}`,
                contract: token,
                from: ME,
                to: lookAlikeOf(CONTACT, '7'),
                value: '0',
                token_name: 'Fake Token',
                token_symbol: 'FAKE',
                token_decimals: 6,
            },
        ],
    })
})()

const markerOf = (item: EvmHistoryItemResponse) =>
    `transaction_row_suspected_poisoning_${item.hash}`

const renderHistory = () =>
    renderWithNavigation(AccountHistory, 'AccountHistory', {
        additionalScreens: [
            { name: 'TransactionDetails', component: TransactionDetailsScreen },
        ],
    })

const openRow = (item: EvmHistoryItemResponse) => {
    const row = closestPressable(
        screen.getByTestId(`transaction_row_${item.hash}`),
    )
    if (!row) throw new Error('Row is not pressable')
    fireEvent.click(row)
}

describe('Flow: suspected address poisoning in Ethereum history', () => {
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
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ACCOUNT.id)
        useContactsStore.setState({
            contacts: [
                { id: 'alice', name: 'Alice', addresses: { evm: CONTACT } },
            ],
        })
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ME]: [
                        [
                            ZERO_FROM_CONTACT_LOOK_ALIKE,
                            DUST_FROM_PAYEE_LOOK_ALIKE,
                            REAL_FROM_CONTACT_LOOK_ALIKE,
                            SENT_TO_PAYEE,
                        ],
                    ],
                },
            }),
        )
    })

    afterEach(() => {
        server.resetHandlers()
        useAccountsStore.getState().setAccounts([])
        useContactsStore.setState({ contacts: [] })
    })

    it('Given worthless transfers from look-alikes of a contact and of a payee, then both are marked and real value is not', async () => {
        renderHistory()

        await screen.findByTestId(
            markerOf(DUST_FROM_PAYEE_LOOK_ALIKE),
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen.getByTestId(markerOf(ZERO_FROM_CONTACT_LOOK_ALIKE)),
        ).toBeTruthy()
        expect(
            screen.queryByTestId(markerOf(REAL_FROM_CONTACT_LOOK_ALIKE)),
        ).toBeNull()
        expect(screen.queryByTestId(markerOf(SENT_TO_PAYEE))).toBeNull()
    })

    it('Given a marked row, when the user presses it, then its details open under an explanation naming the address it imitates', async () => {
        renderHistory()
        await screen.findByTestId(
            markerOf(DUST_FROM_PAYEE_LOOK_ALIKE),
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        openRow(DUST_FROM_PAYEE_LOOK_ALIKE)

        await screen.findByTestId('transaction_details_screen')
        const notice = await screen.findByTestId('suspected_poisoning_notice')
        expect(
            within(notice).getByTestId('suspected_poisoning_imitated_address')
                .textContent,
        ).toBe(addressCodecs.get('ethereum').normalize(PAYEE))
        expect(screen.getByTestId('transaction_detail_explorer')).toBeTruthy()
        expect(notice.textContent).toContain(
            'send_funds.recipient_safety.look_alike_known_label_history',
        )
        expect(notice.textContent).toContain(
            'transactions.suspected_poisoning.do_not_reuse',
        )

        fireEvent.click(screen.getByTestId('suspected_poisoning_dismiss'))

        await waitFor(() =>
            expect(
                screen.queryByTestId('transaction_details_screen'),
            ).toBeNull(),
        )
    })

    it('Given an unmarked row, when the user opens it, then no explanation or Got it shows', async () => {
        renderHistory()
        await screen.findByTestId(
            markerOf(DUST_FROM_PAYEE_LOOK_ALIKE),
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        openRow(REAL_FROM_CONTACT_LOOK_ALIKE)

        await screen.findByTestId('transaction_details_screen')
        expect(screen.queryByTestId('suspected_poisoning_notice')).toBeNull()
        expect(screen.queryByTestId('suspected_poisoning_dismiss')).toBeNull()
    })

    it('Given a token send the history names no signer for, to a look-alike of a contact, then it is marked and its details name the contact', async () => {
        server.use(
            ...peraEvmHistoryHandlers({
                history: {
                    [ME]: [[UNSIGNED_UNKNOWN_TOKEN_TO_CONTACT_LOOK_ALIKE]],
                },
            }),
        )
        renderHistory()
        await screen.findByTestId(
            markerOf(UNSIGNED_UNKNOWN_TOKEN_TO_CONTACT_LOOK_ALIKE),
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        openRow(UNSIGNED_UNKNOWN_TOKEN_TO_CONTACT_LOOK_ALIKE)

        const notice = await screen.findByTestId('suspected_poisoning_notice')
        expect(
            within(notice).getByTestId('suspected_poisoning_imitated_address')
                .textContent,
        ).toBe(addressCodecs.get('ethereum').normalize(CONTACT))
    })
})

// The fake pays nothing: its contract writes a Transfer log "from" the account
// under a symbol dressed as the native coin, and a third address signs it.
const FAKE_NATIVE_SYMBOL = ['13ac', '200d', '13a2', '200d', '041d']
    .map(hex => String.fromCodePoint(Number.parseInt(hex, 16)))
    .join('')
const THIRD_PARTY = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const FAKE_TOKEN = '0x0000000000000000000000000000000000000fa0'
const SENT_WEI = '1000000000000000'

describe.each([
    { chainId: 'ethereum', eip155: 1 },
    { chainId: 'base', eip155: 8453 },
] as const)(
    'Flow: a fake native-coin send in $chainId history',
    ({ chainId, eip155 }) => {
        const scope = { chainId, networkId: 'mainnet' } as const
        const account: WalletAccount = {
            id: `${chainId}-account`,
            custody: {
                kind: 'local',
                seed: SeedScheme.Bip39,
                hd: { account: 0, keyIndex: 0 },
            },
            chains: {
                [chainId]: { address: ACCOUNT_ADDRESS, keyPairId: 'key' },
            },
            name: 'Account',
        }

        const realSend = evmHistoryItem({
            hash: hashOf(6),
            block_time: '2026-01-06T00:00:00Z',
            from: ME,
            to: CONTACT.toLowerCase(),
            value: SENT_WEI,
        })
        const fakeSend = evmHistoryItem({
            hash: hashOf(7),
            block_time: '2026-01-07T00:00:00Z',
            from: THIRD_PARTY.toLowerCase(),
            to: FAKE_TOKEN,
            token_transfers: [
                {
                    asset_id: `eip155:${eip155}/erc20:${FAKE_TOKEN}`,
                    contract: FAKE_TOKEN,
                    from: ME,
                    to: lookAlikeOf(CONTACT, '9'),
                    value: SENT_WEI,
                    token_name: 'Fake',
                    token_symbol: FAKE_NATIVE_SYMBOL,
                    token_decimals: 18,
                },
            ],
        })

        const rowText = (item: EvmHistoryItemResponse) =>
            screen.getByTestId(`transaction_row_${item.hash}`).textContent

        beforeAll(async () => {
            await setupTestDatabase()
        })

        afterAll(async () => {
            await teardownTestDatabase()
        })

        beforeEach(async () => {
            await resetTestDatabase()
            const native = nativeAssetFor(chainId)
            await upsertAssets({ items: [native], scope })
            await upsertAssetPrices({
                prices: [
                    { assetId: native.assetId, usdPrice: new Decimal(3000) },
                ],
                scope,
            })
            useAccountsStore.getState().setAccounts([account])
            useAccountsStore.getState().setSelectedAccountId(account.id)
            useContactsStore.setState({
                contacts: [
                    { id: 'alice', name: 'Alice', addresses: { evm: CONTACT } },
                ],
            })
            server.use(
                ...peraEvmHistoryHandlers({
                    history: { [ME]: [[fakeSend, realSend]] },
                }),
            )
        })

        afterEach(() => {
            server.resetHandlers()
            useAccountsStore.getState().setAccounts([])
            useContactsStore.setState({ contacts: [] })
        })

        it('Given a real send and a fake one of the same amount, then the list tells them apart without opening either', async () => {
            renderHistory()
            await screen.findByTestId(markerOf(fakeSend), undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            })
            const unit = nativeAssetFor(chainId).unitName

            const fake = rowText(fakeSend)
            expect(fake).toContain('transactions.list_item.not_sent_by_you')
            expect(fake).toContain('asset.imitated_currency.unit_label')
            expect(fake).not.toContain('-')
            expect(fake).not.toContain(`0.001 ${unit}`)

            expect(screen.queryByTestId(markerOf(realSend))).toBeNull()
            const real = rowText(realSend)
            expect(real).toContain('transactions.list_item.send')
            expect(real).toContain(`-0.001 ${unit}`)
        })

        it('Given the fake send, when the user presses it, then its details name the token contract beside the explanation and an explorer link', async () => {
            renderHistory()
            await screen.findByTestId(markerOf(fakeSend), undefined, {
                timeout: SLOW_WAIT_TIMEOUT_MS,
            })

            openRow(fakeSend)

            await screen.findByTestId('transaction_details_screen')
            expect(
                screen.getByTestId('suspected_poisoning_notice'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('transaction_detail_explorer'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('ethereum_record_asset_contract'),
            ).toBeTruthy()
        })
    },
)
