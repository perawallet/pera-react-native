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
import { assertBip44PathMatches, parseBip44Path } from '../bip44'
import { DerivationTypes } from '../models'

describe('parseBip44Path', () => {
    it.each([
        ["m/44'/60'/2'/0/7"],
        ['44h/60h/2h/0/7'],
        [" m/44' / 60' /2'/0/ 7 "],
    ])('reads the coordinates of %j', path => {
        expect(parseBip44Path(path, 60)).toEqual({
            account: 2,
            change: 0,
            keyIndex: 7,
        })
    })

    it.each([
        ["m/44'/283'/2'/0/7", 'another coin type'],
        ["m/44'/60'/0x2'/0/7", 'a non-decimal index'],
        ["m/44'/60'/2'/0/7/", 'a trailing slash'],
        ["m/44'/60'/2'/0h/7", 'a hardened change'],
    ])('rejects %s (%s) as malformed', path => {
        expect(() => parseBip44Path(path, 60)).toThrow(
            expect.objectContaining({ reason: 'malformed', hdPath: path }),
        )
    })
})

describe('assertBip44PathMatches', () => {
    it('rejects a path at other coordinates as a mismatch', () => {
        expect(() =>
            assertBip44PathMatches(
                "m/44'/60'/2'/0/8",
                {
                    account: 2,
                    change: 0,
                    keyIndex: 7,
                    derivationType: DerivationTypes.Peikert,
                },
                60,
            ),
        ).toThrow(expect.objectContaining({ reason: 'mismatch' }))
    })
})
