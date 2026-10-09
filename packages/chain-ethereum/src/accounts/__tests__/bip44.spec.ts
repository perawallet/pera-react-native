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
import { DerivationTypes } from '@perawallet/wallet-core-accounts'
import {
    assertEthereumBip44PathMatches,
    parseEthereumBip44Path,
} from '../bip44'

const DETAILS = {
    account: 2,
    change: 0,
    keyIndex: 7,
    derivationType: DerivationTypes.Peikert,
}

describe('parseEthereumBip44Path', () => {
    it.each([["m/44'/60'/2'/0/7"], ["44'/60'/2'/0/7"], ['m/44h/60h/2h/0/7']])(
        'reads the coordinates of %s',
        path => {
            expect(parseEthereumBip44Path(path)).toEqual({
                account: 2,
                change: 0,
                keyIndex: 7,
            })
        },
    )

    it.each([
        ["m/44'/283'/2'/0/7", 'another coin type'],
        ["m/49'/60'/2'/0/7", 'another purpose'],
        ["m/44'/60'/2/0/7", 'an unhardened account'],
        ["m/44'/60'/2'/0'/7", 'a hardened change'],
        ["m/44'/60'/2'/0", 'a missing segment'],
        ["m/44'/60'/2'/0/7/1", 'an extra segment'],
        ["m/44'/60'/-2'/0/7", 'a negative account'],
    ])('rejects %s (%s) as malformed', path => {
        expect(() => parseEthereumBip44Path(path)).toThrow(
            expect.objectContaining({ reason: 'malformed', hdPath: path }),
        )
    })
})

describe('assertEthereumBip44PathMatches', () => {
    it('accepts the path at the account coordinates', () => {
        expect(() =>
            assertEthereumBip44PathMatches("m/44'/60'/2'/0/7", DETAILS),
        ).not.toThrow()
    })

    it.each([["m/44'/60'/3'/0/7"], ["m/44'/60'/2'/1/7"], ["m/44'/60'/2'/0/8"]])(
        'rejects %s as a mismatch',
        path => {
            expect(() => assertEthereumBip44PathMatches(path, DETAILS)).toThrow(
                expect.objectContaining({ reason: 'mismatch' }),
            )
        },
    )
})
