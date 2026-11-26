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

import { describe, expect, test } from 'vitest'
import {
    hasNameableAddress,
    renderNotificationMessage,
} from '../messageTemplate'

const ADDRESS = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'

const transfer = {
    type: 'evm-transfer-received',
    messageTemplate: '{{amount}} ETH received from {{sender}}',
    messageArguments: {
        amount: { text: '1' },
        sender: { text: '0x7099…79c8', address: ADDRESS },
    },
}

const nameSavings = (address: string) =>
    address === ADDRESS ? 'Savings' : undefined

describe('renderNotificationMessage', () => {
    test('fills each placeholder with its text', () => {
        expect(renderNotificationMessage(transfer)).toBe(
            '1 ETH received from 0x7099…79c8',
        )
    })

    test('names a marked address the namer knows', () => {
        expect(renderNotificationMessage(transfer, nameSavings)).toBe(
            '1 ETH received from Savings',
        )
    })

    test('keeps the text when the namer has no name', () => {
        expect(renderNotificationMessage(transfer, () => undefined)).toBe(
            '1 ETH received from 0x7099…79c8',
        )
    })

    test('never names an unmarked argument, even one whose text is an address', () => {
        const notification = {
            ...transfer,
            messageArguments: {
                amount: { text: '1' },
                sender: { text: ADDRESS },
            },
        }
        expect(renderNotificationMessage(notification, () => 'Savings')).toBe(
            `1 ETH received from ${ADDRESS}`,
        )
    })

    test('does not substitute inside an inserted value', () => {
        const notification = {
            type: 'transaction-received',
            messageTemplate: '{{amount}} ALGO with {{note}}',
            messageArguments: {
                amount: { text: '10' },
                note: { text: 'note: to {{amount}}' },
            },
        }
        expect(renderNotificationMessage(notification)).toBe(
            '10 ALGO with note: to {{amount}}',
        )
    })

    test('keeps a literal $ and replacement patterns as written', () => {
        const notification = {
            type: 'x',
            messageTemplate: '${{usd}} from {{sender}}',
            messageArguments: {
                usd: { text: '5' },
                sender: { text: "$& $1 $'" },
            },
        }
        expect(renderNotificationMessage(notification)).toBe("$5 from $& $1 $'")
    })

    test('leaves a placeholder with no argument as written, own keys only', () => {
        const notification = {
            type: 'x',
            messageTemplate: '{{missing}} {{constructor}}',
            messageArguments: {},
        }
        expect(renderNotificationMessage(notification)).toBe(
            '{{missing}} {{constructor}}',
        )
    })

    test('names nothing on an asset support request', () => {
        const notification = { ...transfer, type: 'asset-support-request' }
        expect(renderNotificationMessage(notification, nameSavings)).toBe(
            '1 ETH received from 0x7099…79c8',
        )
    })

    test('passes a missing template through', () => {
        expect(
            renderNotificationMessage({ ...transfer, messageTemplate: null }),
        ).toBeNull()
    })
})

describe('hasNameableAddress', () => {
    test('is true with a marked argument on a trusted type', () => {
        expect(hasNameableAddress(transfer)).toBe(true)
    })

    test('is false without a marked argument', () => {
        expect(hasNameableAddress({ ...transfer, messageArguments: {} })).toBe(
            false,
        )
    })

    test('is false on an asset support request', () => {
        expect(
            hasNameableAddress({ ...transfer, type: 'asset-support-request' }),
        ).toBe(false)
    })
})
