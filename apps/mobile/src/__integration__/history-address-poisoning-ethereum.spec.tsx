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

// On Ethereum, which has no transaction detail screen, a worthless transfer
// from a look-alike of a known address is marked in History and pressing it
// explains the marker. Copy is asserted by key: this project renders i18n keys.

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
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// The integration setup loads the Pera query client before this file's config
// mock exists, and the client reads its deployments once, so everything under
// test is loaded afresh, the test theme the setup installed included.
vi.resetModules()
const { setTestTheme } = await import('@test-utils/test-theme')
const { getTheme } = await import('@theme/theme')
setTestTheme(getTheme('light'))
const { fireEvent, screen, within } = await import('@testing-library/react')
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

const markerOf = (item: EvmHistoryItemResponse) =>
    `transaction_row_suspected_poisoning_${item.hash}`

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
        renderWithNavigation(AccountHistory, 'AccountHistory')

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

    it('Given a marked row, when the user presses it, then a sheet explains it and names the address it imitates', async () => {
        renderWithNavigation(AccountHistory, 'AccountHistory')
        await screen.findByTestId(
            markerOf(DUST_FROM_PAYEE_LOOK_ALIKE),
            undefined,
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        const row = closestPressable(
            screen.getByTestId(
                `transaction_row_${DUST_FROM_PAYEE_LOOK_ALIKE.hash}`,
            ),
        )
        if (!row) throw new Error('Marked row is not pressable')
        fireEvent.click(row)

        const notice = await screen.findByTestId('suspected_poisoning_notice')
        expect(
            within(notice).getByTestId('suspected_poisoning_imitated_address')
                .textContent,
        ).toBe(addressCodecs.get('ethereum').normalize(PAYEE))
        expect(notice.textContent).toContain(
            'send_funds.recipient_safety.look_alike_known_label_history',
        )
    })
})
