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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { signArbitraryData } from '../signArbitraryData'

const signPayloads = vi.fn()
const deps = { signPayloads }

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd-child',
    type: 'hdWallet',
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
    type: 'algo25',
} as unknown as WalletAccount

const b64 = (text: string) => encodeToBase64(new TextEncoder().encode(text))

describe('signArbitraryData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        signPayloads.mockResolvedValue([new Uint8Array([9, 8, 7])])
    })

    test('signs an HD account with its child id and MX-prefixed bytes', async () => {
        await signArbitraryData(deps, hdAccount, [b64('hello')])

        expect(signPayloads).toHaveBeenCalledTimes(1)
        const [keyPairId, items] = signPayloads.mock.calls[0]
        expect(keyPairId).toBe('key-hd-child')
        expect(items).toHaveLength(1)
        expect(Array.from((items[0] as Uint8Array).slice(0, 2))).toEqual([
            'M'.charCodeAt(0),
            'X'.charCodeAt(0),
        ])
        expect(
            new TextDecoder().decode((items[0] as Uint8Array).slice(2)),
        ).toBe('hello')
    })

    test('signs every item of a batch in one call', async () => {
        await signArbitraryData(deps, hdAccount, [
            b64('item1'),
            b64('item2'),
            b64('item3'),
        ])

        const [, items] = signPayloads.mock.calls[0]
        expect(items).toHaveLength(3)
    })

    test('returns the signatures it was given', async () => {
        const expectedSig = new Uint8Array([42, 43, 44])
        signPayloads.mockResolvedValue([expectedSig])

        await expect(
            signArbitraryData(deps, hdAccount, [b64('hello')]),
        ).resolves.toEqual([expectedSig])
    })

    test('signs an Algo25 account with its own child id', async () => {
        await signArbitraryData(deps, algo25Account, [b64('hello')])

        expect(signPayloads.mock.calls[0][0]).toBe('key-algo25-ed25519')
    })

    test("signs with the requested account's OWN key even when rekeyed", async () => {
        // The dApp verifies the signature against the requested address's
        // own pubkey, so the account's own keypair is used, never the auth
        // chain.
        const original = {
            ...algo25Account,
            address: 'ORIGINAL_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount

        await signArbitraryData(deps, original, [b64('hello')])

        expect(signPayloads.mock.calls[0][0]).toBe('key-algo25-ed25519')
    })

    test.each([
        [
            'a watch-rekeyed account',
            { address: 'W', type: 'watch', rekeyAddress: 'A' },
        ],
        ['a watch account', { address: 'W', type: 'watch' }],
        [
            'a hardware wallet account',
            {
                address: 'HW',
                type: 'hardware',
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'd',
                    deviceName: 'L',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            },
        ],
    ])('rejects %s without signing', async (_name, account) => {
        await expect(
            signArbitraryData(deps, account as unknown as WalletAccount, [
                b64('hello'),
            ]),
        ).rejects.toThrow(/Cannot sign arbitrary data/)
        expect(signPayloads).not.toHaveBeenCalled()
    })
})
