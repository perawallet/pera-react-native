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
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import type { PeraNotification } from '@perawallet/wallet-core-messages'
import { useCounterpartyNamedNotifications } from '../useCounterpartyNamedNotifications'

const ADDRESS = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
// Same first six and last four characters as ADDRESS: one short form for both.
const LOOK_ALIKE = '0x709979aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa79c8'
const OTHER_ADDRESS = '0x90f79bf6eb2c4f870365e785982e1f101e93b906'
const ALGORAND_ADDRESS =
    'X6MNR4AVJQEMJRHAPZ6F3UKCO5LD46UQ5TGHVJXOMYCB4BV7DL6FRM2NJU'

const account = (
    name: string,
    address = ADDRESS,
    chainId = 'ethereum',
): WalletAccount =>
    ({
        id: `account-${name}`,
        name,
        chains: { [chainId]: { address, keyPairId: 'key' } },
    }) as unknown as WalletAccount

const contact = (name: string, address = ADDRESS): Contact =>
    ({
        id: `contact-${name}`,
        name,
        addresses: { evm: address },
    }) as Contact

const row = (
    sender: { text: string; address?: string } = {
        text: '0x7099…79c8',
        address: ADDRESS,
    },
    overrides: Partial<PeraNotification> = {},
): PeraNotification => ({
    id: '1',
    type: 'evm-transfer-received',
    accountAddress: null,
    messageTemplate: '1 ETH received from {{sender}} on Ethereum',
    messageArguments: { sender },
    message: `1 ETH received from ${sender.text} on Ethereum`,
    url: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
})

const seed = ({
    accounts = [],
    contacts = [],
}: {
    accounts?: WalletAccount[]
    contacts?: Contact[]
}) => {
    vi.mocked(useAllAccounts).mockReturnValue(accounts)
    vi.mocked(useContactsStore).mockImplementation(((
        selector?: (state: unknown) => unknown,
    ) => {
        const state = { contacts }
        return selector ? selector(state) : state
    }) as unknown as typeof useContactsStore)
}

const render = (notifications: PeraNotification[]) =>
    renderHook(() => useCounterpartyNamedNotifications(notifications))

describe('useCounterpartyNamedNotifications', () => {
    beforeEach(() => {
        seed({})
    })

    it("names a marked address after the user's own account", () => {
        seed({ accounts: [account('Savings')] })

        const { result } = render([row()])

        expect(result.current[0].message).toBe(
            '1 ETH received from Savings on Ethereum',
        )
    })

    it('names a marked address after a saved contact', () => {
        seed({ contacts: [contact('Alice')] })

        const { result } = render([row()])

        expect(result.current[0].message).toBe(
            '1 ETH received from Alice on Ethereum',
        )
    })

    it('prefers the account over a contact holding the same address', () => {
        seed({ accounts: [account('Savings')], contacts: [contact('Alice')] })

        const { result } = render([row()])

        expect(result.current[0].message).toContain('Savings')
    })

    it('falls back to the contact when the account has no name', () => {
        seed({ accounts: [account('')], contacts: [contact('Alice')] })

        const { result } = render([row()])

        expect(result.current[0].message).toContain('Alice')
    })

    it('names an Algorand address', () => {
        seed({ accounts: [account('Main', ALGORAND_ADDRESS, 'algorand')] })
        const algorandRow = row(
            { text: 'X6MN…2NJU', address: ALGORAND_ADDRESS },
            { type: 'transaction-received' },
        )

        const { result } = render([algorandRow])

        expect(result.current[0].message).toBe(
            '1 ETH received from Main on Ethereum',
        )
    })

    it('never names a look-alike address that shortens the same', () => {
        seed({ accounts: [account('Savings')], contacts: [contact('Alice')] })
        const notifications = [
            row({ text: '0x7099…79c8', address: LOOK_ALIKE }),
        ]

        const { result } = render(notifications)

        expect(result.current).toBe(notifications)
    })

    it('never names an argument the backend left unmarked', () => {
        seed({ accounts: [account('Savings')] })
        const notifications = [row({ text: '0x7099…79c8' })]

        const { result } = render(notifications)

        expect(result.current).toBe(notifications)
    })

    it('never names the client-claimed sender of an asset support request', () => {
        seed({ contacts: [contact('Alice')] })
        const notifications = [
            row(undefined, { type: 'asset-support-request' }),
        ]

        const { result } = render(notifications)

        expect(result.current).toBe(notifications)
    })

    it('returns the same list when no row is named', () => {
        seed({ accounts: [account('Savings', OTHER_ADDRESS)] })
        const notifications = [row()]

        const { result } = render(notifications)

        expect(result.current).toBe(notifications)
    })

    it('follows a rename on the next render', () => {
        seed({ accounts: [account('Savings')] })
        const notifications = [row()]
        const { result, rerender } = render(notifications)

        seed({ accounts: [account('Vault')] })
        rerender()

        expect(result.current[0].message).toBe(
            '1 ETH received from Vault on Ethereum',
        )
    })
})
