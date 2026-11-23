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

import { describe, expect, it } from 'vitest'
import {
    nameNotificationCounterparty,
    notificationCounterpartyAddress,
} from '../counterparty'
import type { PeraNotification } from '../models'

const CHECKSUM_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const row = (overrides: Partial<PeraNotification> = {}): PeraNotification => ({
    id: '1',
    type: 'evm-transfer-received',
    accountAddress: '0xabc',
    message: '1 ETH received from 0x7099…79c8 on Ethereum',
    counterpartyAddress: CHECKSUM_ADDRESS,
    url: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
})

describe('nameNotificationCounterparty', () => {
    it('puts the name where the short address was', () => {
        const result = nameNotificationCounterparty(row(), 'Savings')

        expect(result.message).toBe('1 ETH received from Savings on Ethereum')
        expect(result.id).toBe('1')
    })

    it('finds an uppercase short form for a lowercase address', () => {
        const result = nameNotificationCounterparty(
            row({
                message: 'Sent to 0x7099…79C8',
                counterpartyAddress: CHECKSUM_ADDRESS.toLowerCase(),
            }),
            'Savings',
        )

        expect(result.message).toBe('Sent to Savings')
    })

    it('leaves the row alone when the short form occurs twice', () => {
        const notification = row({
            type: 'evm-transfer-failed',
            message: 'Failed: 0x7099…79c8 sent to 0x7099…79c8',
        })

        expect(nameNotificationCounterparty(notification, 'Savings')).toBe(
            notification,
        )
    })

    it('leaves the row alone when the short form is absent', () => {
        const notification = row({ message: 'Received from 0x1234…5678' })

        expect(nameNotificationCounterparty(notification, 'Savings')).toBe(
            notification,
        )
    })

    it('inserts the name literally, without replacement patterns', () => {
        const result = nameNotificationCounterparty(row(), 'Savings $& $1')

        expect(result.message).toBe(
            '1 ETH received from Savings $& $1 on Ethereum',
        )
    })

    it('names a row whose text holds characters that change length when lowercased', () => {
        const result = nameNotificationCounterparty(
            row({ message: 'İşlem received from 0x7099…79c8' }),
            'Savings',
        )

        expect(result.message).toBe('İşlem received from Savings')
    })

    it('leaves the row alone for an empty name', () => {
        const notification = row()

        expect(nameNotificationCounterparty(notification, '')).toBe(
            notification,
        )
    })

    it('leaves an Algorand row alone even with a counterparty address set', () => {
        const notification = row({ type: 'transaction-received' })

        expect(nameNotificationCounterparty(notification, 'Savings')).toBe(
            notification,
        )
    })

    it.each([
        ['a null message', { message: null }],
        ['a null counterparty address', { counterpartyAddress: null }],
        ['no counterparty address', { counterpartyAddress: undefined }],
    ])('leaves the row alone with %s', (_label, overrides) => {
        const notification = row(overrides)

        expect(nameNotificationCounterparty(notification, 'Savings')).toBe(
            notification,
        )
    })
})

describe('notificationCounterpartyAddress', () => {
    it.each([
        'evm-transfer-received',
        'evm-transfer-sent',
        'evm-transfer-failed',
    ])('reads the address of a %s row', type => {
        expect(notificationCounterpartyAddress(row({ type }))).toBe(
            CHECKSUM_ADDRESS,
        )
    })

    it('reads nothing from an Algorand row', () => {
        expect(
            notificationCounterpartyAddress(row({ type: 'transaction-sent' })),
        ).toBeUndefined()
    })

    it('reads nothing from a row without a type', () => {
        expect(
            notificationCounterpartyAddress(row({ type: null })),
        ).toBeUndefined()
    })
})
