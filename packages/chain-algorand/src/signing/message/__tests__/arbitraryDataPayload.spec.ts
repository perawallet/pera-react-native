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

import { describe, test, expect, beforeEach } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { seedAuthority } from '../../../accounts/__tests__/seedAuthority'
import { arbitraryDataPayloadFor } from '../arbitraryDataPayload'

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd-child',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 1 } },
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-algo25-ed25519',
    custody: { kind: 'local', seed: null },
} as unknown as WalletAccount

const b64 = (text: string) => encodeToBase64(new TextEncoder().encode(text))

describe('arbitraryDataPayloadFor', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
    })

    test('prefixes the decoded bytes with MX for an HD account', () => {
        const payload = arbitraryDataPayloadFor(hdAccount, b64('hello'))

        expect(Array.from(payload.slice(0, 2))).toEqual([
            'M'.charCodeAt(0),
            'X'.charCodeAt(0),
        ])
        expect(new TextDecoder().decode(payload.slice(2))).toBe('hello')
    })

    test('builds the same payload for an Algo25 account', () => {
        const payload = arbitraryDataPayloadFor(algo25Account, b64('hello'))

        expect(payload).toEqual(
            arbitraryDataPayloadFor(hdAccount, b64('hello')),
        )
    })

    test('does not follow a rekey: the requested account is still signable', () => {
        // The dApp verifies against the requested address's own pubkey.
        const original = {
            ...algo25Account,
            address: 'ORIGINAL_ADDR',
        } as unknown as WalletAccount
        seedAuthority('ORIGINAL_ADDR', 'AUTH_ADDR')

        expect(() =>
            arbitraryDataPayloadFor(original, b64('hello')),
        ).not.toThrow()
    })

    test.each([
        [
            'a watch-rekeyed account',
            { address: 'W', custody: { kind: 'watch' } },
            'A',
        ],
        ['a watch account', { address: 'W', custody: { kind: 'watch' } }],
        [
            'a hardware wallet account',
            {
                address: 'HW',
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'd',
                        deviceName: 'L',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'd',
                    deviceName: 'L',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            },
        ],
    ])('rejects %s', (_name, account, authority) => {
        if (authority) seedAuthority(account.address, authority)

        expect(() =>
            arbitraryDataPayloadFor(
                account as unknown as WalletAccount,
                b64('hello'),
            ),
        ).toThrow(/Cannot sign arbitrary data/)
    })
})
