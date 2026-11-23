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
const OTHER_ADDRESS = '0x90f79bf6eb2c4f870365e785982e1f101e93b906'

const account = (name: string, address = ADDRESS): WalletAccount =>
    ({
        id: `account-${name}`,
        name,
        chains: { ethereum: { address, keyPairId: 'key' } },
    }) as unknown as WalletAccount

const contact = (name: string, address = ADDRESS): Contact =>
    ({
        id: `contact-${name}`,
        name,
        addresses: { evm: address },
    }) as Contact

const row = (overrides: Partial<PeraNotification> = {}): PeraNotification => ({
    id: '1',
    type: 'evm-transfer-received',
    accountAddress: null,
    message: '1 ETH received from 0x7099…79c8 on Ethereum',
    counterpartyAddress: ADDRESS,
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

describe('useCounterpartyNamedNotifications', () => {
    beforeEach(() => {
        seed({})
    })

    it("names the counterparty after the user's own account", () => {
        seed({ accounts: [account('Savings')] })
        const notifications = [row()]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current[0].message).toBe(
            '1 ETH received from Savings on Ethereum',
        )
    })

    it('names the counterparty after a saved contact', () => {
        seed({ contacts: [contact('Alice')] })
        const notifications = [row()]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current[0].message).toBe(
            '1 ETH received from Alice on Ethereum',
        )
    })

    it('prefers the account over a contact holding the same address', () => {
        seed({ accounts: [account('Savings')], contacts: [contact('Alice')] })
        const notifications = [row()]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current[0].message).toContain('Savings')
    })

    it('falls back to the contact when the account has no name', () => {
        seed({ accounts: [account('')], contacts: [contact('Alice')] })
        const notifications = [row()]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current[0].message).toContain('Alice')
    })

    it('keeps the row for an unknown address', () => {
        seed({
            accounts: [account('Savings', OTHER_ADDRESS)],
            contacts: [contact('Alice', OTHER_ADDRESS)],
        })
        const notifications = [row()]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current[0]).toBe(notifications[0])
    })

    it('returns the same list when no row is named', () => {
        seed({ accounts: [account('Savings', OTHER_ADDRESS)] })
        const notifications = [row()]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current).toBe(notifications)
    })

    it('keeps a row without a counterparty address', () => {
        seed({ accounts: [account('Savings')] })
        const notifications = [row({ counterpartyAddress: null })]

        const { result } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        expect(result.current[0]).toBe(notifications[0])
    })

    it('follows a rename on the next render', () => {
        seed({ accounts: [account('Savings')] })
        const notifications = [row()]
        const { result, rerender } = renderHook(() =>
            useCounterpartyNamedNotifications(notifications),
        )

        seed({ accounts: [account('Vault')] })
        rerender()

        expect(result.current[0].message).toBe(
            '1 ETH received from Vault on Ethereum',
        )
    })
})
