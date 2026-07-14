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
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AsbAccountKind, type AsbBackupAccount } from '../../models'
import { partitionImportableAccounts } from '../partition-importable-accounts'

const validAddressA =
    'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM'
const validAddressB =
    '7TTLR5VQAY5YVQ5QV4IBOVIKUULGVNPURNWM5NG7M7ELEOQPVROA4CS3FM'

const single = (address: string): AsbBackupAccount => ({
    address,
    name: null,
    kind: AsbAccountKind.Single,
    privateKey: new Uint8Array(64),
})

const watch = (address: string): AsbBackupAccount => ({
    address,
    name: null,
    kind: AsbAccountKind.Watch,
    privateKey: null,
})

const algo25 = (address: string): WalletAccount => ({
    id: address,
    address,
    type: AccountTypes.algo25,
    keyPairId: 'k',
})

describe('partitionImportableAccounts', () => {
    it('splits asb accounts into importable / already-imported / unsupported', () => {
        const asb = [
            single(validAddressA),
            watch(validAddressB),
            single('NOT_A_VALID_ADDRESS'),
        ]
        const existing = [algo25(validAddressA)]

        const result = partitionImportableAccounts(asb, existing)

        expect(result.importable).toEqual([watch(validAddressB)])
        expect(result.alreadyImported).toEqual([single(validAddressA)])
        expect(result.unsupported).toHaveLength(1)
        expect(result.unsupported[0].address).toBe('NOT_A_VALID_ADDRESS')
    })

    it('treats an empty wallet as all-importable for valid addresses', () => {
        const asb = [single(validAddressA), watch(validAddressB)]
        const result = partitionImportableAccounts(asb, [])
        expect(result.importable).toHaveLength(2)
        expect(result.alreadyImported).toEqual([])
        expect(result.unsupported).toEqual([])
    })
})
