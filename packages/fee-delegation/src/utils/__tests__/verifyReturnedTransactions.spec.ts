/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

import { returnedTransactionsMatchSent } from '../verifyReturnedTransactions'

const ACCOUNT = 'TESTACCOUNTADDRESS'
const ATTACKER = 'ATTACKERADDRESS'

/**
 * Minimal stand-in for an algosdk Transaction. The real encoder serializes the
 * whole transaction including `sender`/`receiver`/`amount`; the fake encoder
 * here serializes the discriminating fields so a substituted txn produces
 * different bytes, while `group` is excluded by the util under test.
 */
type FakeTransaction = {
    sender: { toString: () => string }
    payload: string
    group?: Uint8Array
}

const makeTxn = (sender: string, payload: string): FakeTransaction => ({
    sender: { toString: () => sender },
    payload,
})

// Serializes sender + payload but deliberately NOT group, so callers cannot
// rely on the encoder to mask a group difference.
const encodeTransaction = (txn: PeraTransaction): Uint8Array => {
    const fake = txn as unknown as FakeTransaction
    return new Uint8Array(
        [...`${fake.sender.toString()}|${fake.payload}`].map(c =>
            c.charCodeAt(0),
        ),
    )
}

const verify = (sent: FakeTransaction[], returnedToSign: FakeTransaction[]) =>
    returnedTransactionsMatchSent({
        sent: sent as unknown as PeraTransaction[],
        returnedToSign: returnedToSign as unknown as PeraTransaction[],
        account: ACCOUNT,
        encodeTransaction,
    })

describe('fee-delegation/returnedTransactionsMatchSent', () => {
    test('accepts a returned slot that is byte-identical modulo the re-assigned group', () => {
        const sent = makeTxn(ACCOUNT, 'optin')
        const returned = {
            ...makeTxn(ACCOUNT, 'optin'),
            group: new Uint8Array([1, 2, 3]),
        }

        expect(verify([sent], [returned])).toBe(true)
    })

    test('rejects a substituted transaction body', () => {
        const sent = makeTxn(ACCOUNT, 'optin')
        const substituted = makeTxn(ACCOUNT, 'drain-payment')

        expect(verify([sent], [substituted])).toBe(false)
    })

    test('rejects a slot whose sender is not the requesting account', () => {
        const sent = makeTxn(ATTACKER, 'optin')
        const returned = makeTxn(ATTACKER, 'optin')

        expect(verify([sent], [returned])).toBe(false)
    })

    test('rejects when the backend returns a different number of slots', () => {
        const sent = makeTxn(ACCOUNT, 'optin')
        const extra = makeTxn(ACCOUNT, 'extra')

        expect(verify([sent], [sent, extra])).toBe(false)
    })

    test('rejects when the backend reorders the wallet slots', () => {
        const first = makeTxn(ACCOUNT, 'first')
        const second = makeTxn(ACCOUNT, 'second')

        expect(verify([first, second], [second, first])).toBe(false)
    })

    test('does not permanently clear the group field of inspected transactions', () => {
        const group = new Uint8Array([9, 9, 9])
        const returned = { ...makeTxn(ACCOUNT, 'optin'), group }

        verify([makeTxn(ACCOUNT, 'optin')], [returned])

        expect(returned.group).toBe(group)
    })
})
