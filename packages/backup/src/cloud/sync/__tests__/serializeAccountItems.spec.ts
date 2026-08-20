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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    parseAddressPayload,
    parseSecretsPayload,
} from '../../api/payloadParsers'
import { serializeAccountItems } from '../serializeAccountItems'
import { canonicalJson } from '../canonicalize'

const algo25: WalletAccount = {
    id: '1',
    type: AccountTypes.algo25,
    address: 'ADDR',
    keyPairId: 'seed-1-ed25519',
    name: 'Main',
}

describe('serializeAccountItems', () => {
    it('serializes an algo25 account to address + secrets items that round-trip', () => {
        const result = serializeAccountItems(algo25, {
            updatedAt: 1719300000000,
            secrets: { type: 'algo25', mnemonic: 'word1 word2' },
        })
        expect(result).not.toBeNull()
        expect(result?.address.key).toBe('accounts/ADDR')
        expect(result?.secrets?.key).toBe('secrets/ADDR')
        expect(
            parseAddressPayload(canonicalJson(result!.address.payload)),
        ).toMatchObject({
            type: 'algo25',
            address: 'ADDR',
            customName: 'Main',
            updatedAt: 1719300000000,
        })
        expect(
            parseSecretsPayload(canonicalJson(result!.secrets!.payload)),
        ).toMatchObject({
            type: 'algo25',
            mnemonic: 'word1 word2',
        })
    })

    it('serializes a watch account to an address-only item (no secrets)', () => {
        const watch: WalletAccount = {
            id: '2',
            type: AccountTypes.watch,
            address: 'WADDR',
            name: 'Watcher',
        }
        const result = serializeAccountItems(watch, {
            updatedAt: 1,
            secrets: null,
        })
        expect(result?.address.key).toBe('accounts/WADDR')
        expect(result?.secrets).toBeNull()
        expect(
            parseAddressPayload(canonicalJson(result!.address.payload)),
        ).toMatchObject({
            type: 'watch',
            address: 'WADDR',
            customName: 'Watcher',
        })
    })

    it('returns null for HD accounts when no hd context is provided', () => {
        const hd: WalletAccount = {
            id: '3',
            type: AccountTypes.hdWallet,
            address: 'HADDR',
            keyPairId: 'k',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }
        expect(
            serializeAccountItems(hd, { updatedAt: 1, secrets: null }),
        ).toBeNull()
    })

    it('builds an hdWallet address payload from the injected hd context (no personal secret)', () => {
        const hd: WalletAccount = {
            id: '3',
            type: AccountTypes.hdWallet,
            address: 'CHILD',
            keyPairId: 'seed-1-acc0-idx1-dt9',
            name: 'Child 1',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
            },
        }
        const result = serializeAccountItems(hd, {
            updatedAt: 1719300000000,
            secrets: null,
            hd: { seedFirstDerivedAddress: 'FIRST', publicKeyHex: 'aabb' },
        })
        expect(result?.address.key).toBe('accounts/CHILD')
        expect(result?.secrets).toBeNull()
        expect(result?.address.payload).toMatchObject({
            type: 'hdWallet',
            address: 'CHILD',
            seedFirstDerivedAddress: 'FIRST',
            publicKey: 'aabb',
            account: 0,
            change: 0,
            keyIndex: 1,
            derivationType: 9,
            customName: 'Child 1',
            updatedAt: 1719300000000,
        })
    })
})
