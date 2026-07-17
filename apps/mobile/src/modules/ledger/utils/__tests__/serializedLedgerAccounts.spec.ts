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

import { describe, it, expect } from 'vitest'
import {
    deserializeLedgerAccount,
    deserializeSelectableAccount,
    serializeLedgerAccount,
    serializeSelectableAccount,
} from '../serializedLedgerAccounts'

import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import type { LedgerSelectableAccount } from '@perawallet/wallet-core-accounts'

const account: LedgerAccount = {
    address: 'AAA111',
    publicKey: new Uint8Array([0, 1, 2, 255, 128, 64]),
    accountIndex: 3,
}

describe('serialized ledger navigation params', () => {
    it('round-trips a derived account through the serialized shape', () => {
        const serialized = serializeLedgerAccount(account)

        // Navigation state must be JSON-safe: no Uint8Array anywhere.
        expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized)

        expect(deserializeLedgerAccount(serialized)).toEqual(account)
    })

    it('round-trips both selectable-account kinds', () => {
        const derived: LedgerSelectableAccount = { kind: 'derived', account }
        const rekeyed: LedgerSelectableAccount = {
            kind: 'rekeyed',
            address: 'REKEYED222',
            authAccount: account,
        }

        for (const selectable of [derived, rekeyed]) {
            const serialized = serializeSelectableAccount(selectable)
            expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized)
            expect(deserializeSelectableAccount(serialized)).toEqual(selectable)
        }
    })
})
