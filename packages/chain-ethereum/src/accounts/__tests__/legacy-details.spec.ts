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
import { AccountError, DerivationTypes } from '@perawallet/wallet-core-accounts'
import { ethereumLegacyDetails } from '../legacy-details'

const ENTRY = { address: '0x00000000000000000000000000000000000000aa' }

describe('ethereumLegacyDetails', () => {
    it('gives an HD account its coordinates on change 0', () => {
        expect(
            ethereumLegacyDetails(
                {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 4, keyIndex: 2 },
                },
                ENTRY,
            ),
        ).toEqual({
            hdWalletDetails: {
                account: 4,
                change: 0,
                keyIndex: 2,
                derivationType: DerivationTypes.Peikert,
            },
        })
    })

    it.each([
        ['a private-key account', { kind: 'local', seed: null } as const],
        ['a watch account', { kind: 'watch' } as const],
    ])('gives %s no legacy details', (_, custody) => {
        expect(ethereumLegacyDetails(custody, ENTRY)).toEqual({})
    })

    it('refuses a multisig custody', () => {
        expect(() =>
            ethereumLegacyDetails({ kind: 'multisig' }, ENTRY),
        ).toThrow(AccountError)
    })
})
