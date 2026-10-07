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
import { AccountError, DerivationTypes } from '@perawallet/wallet-core-accounts'
import { algorandLegacyDetails } from '../legacy-details'

describe('algorandLegacyDetails', () => {
    test('writes the fixed Peikert HD details from the custody position', () => {
        expect(
            algorandLegacyDetails(
                {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 1, keyIndex: 4 },
                },
                { address: 'ADDR', keyPairId: 'seed-acc1-idx4-dt9' },
            ),
        ).toEqual({
            hdWalletDetails: {
                account: 1,
                change: 0,
                keyIndex: 4,
                derivationType: DerivationTypes.Peikert,
            },
        })
    })

    test('derives the multisig details from the native member', () => {
        expect(
            algorandLegacyDetails(
                { kind: 'multisig' },
                {
                    address: 'ADDR',
                    native: {
                        family: 'algorand',
                        multisig: {
                            version: 1,
                            threshold: 2,
                            addresses: ['P1', 'P2'],
                        },
                    },
                },
            ),
        ).toEqual({
            multisigDetails: {
                version: 1,
                threshold: 2,
                addresses: ['P1', 'P2'],
            },
        })
    })

    test('refuses a multisig custody without its multisig', () => {
        expect(() =>
            algorandLegacyDetails({ kind: 'multisig' }, { address: 'ADDR' }),
        ).toThrow(AccountError)
    })

    test.each([
        { kind: 'watch' as const },
        { kind: 'local' as const, seed: 'algo25' as const },
    ])('adds no details for $kind custody', custody => {
        expect(algorandLegacyDetails(custody, { address: 'ADDR' })).toEqual({})
    })
})
