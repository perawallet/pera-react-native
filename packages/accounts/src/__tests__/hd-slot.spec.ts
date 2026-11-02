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

import { describe, test, expect } from 'vitest'
import { nextHdSlotForSeed } from '../hd-slot'
import type { WalletAccount } from '../models'
import { buildTestAccount, TEST_CUSTODY, testAccount } from './accountFactory'

const hd = (account: number, keyIndex = 0): WalletAccount =>
    buildTestAccount(
        {
            kind: 'local',
            seed: TEST_CUSTODY.hd.seed,
            hd: { account, keyIndex },
        },
        {
            algorand: {
                address: `ADDR-${account}-${keyIndex}`,
                keyPairId: `seed-1-acc${account}-idx${keyIndex}`,
            },
        },
    )

describe('nextHdSlotForSeed', () => {
    test('takes the account index after the seed highest, on keyIndex 0', () => {
        expect(nextHdSlotForSeed('seed-1', [hd(0), hd(1)])).toEqual({
            walletId: 'seed-1',
            account: 2,
            keyIndex: 0,
        })
    })

    test('does not fill a gap in the account indexes', () => {
        expect(nextHdSlotForSeed('seed-1', [hd(0), hd(3)])).toMatchObject({
            account: 4,
            keyIndex: 0,
        })
    })

    test('moves a keyIndex-axis seed onto the account axis past its highest number', () => {
        expect(
            nextHdSlotForSeed('seed-1', [hd(0, 0), hd(0, 1), hd(0, 2)]),
        ).toMatchObject({ account: 3, keyIndex: 0 })
    })

    test('takes the number after the highest when a seed holds accounts on both axes', () => {
        expect(nextHdSlotForSeed('seed-1', [hd(2), hd(0, 4)])).toMatchObject({
            account: 5,
            keyIndex: 0,
        })
    })

    test('skips at most four account indexes, so discovery still reaches the new account', () => {
        const keyAxis = Array.from({ length: 8 }, (_, keyIndex) =>
            hd(0, keyIndex),
        )
        expect(nextHdSlotForSeed('seed-1', keyAxis)).toMatchObject({
            account: 5,
            keyIndex: 0,
        })
    })

    test.each([
        ['no accounts', []],
        [
            'only non-HD accounts',
            [testAccount('hardware'), testAccount('watch')],
        ],
    ])('starts at account 0 with %s', (_, accounts) => {
        expect(nextHdSlotForSeed('seed-1', accounts)).toEqual({
            walletId: 'seed-1',
            account: 0,
            keyIndex: 0,
        })
    })
})
