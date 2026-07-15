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
import {
    ALGORAND_COIN_TYPE,
    assertAlgorandBip44PathMatches,
    hdPathMatchesDetails,
    InvalidBip44PathError,
    parseAlgorandBip44Path,
} from '../bip44'
import { DerivationTypes, type HDWalletDetails } from '../models'

const details: HDWalletDetails = {
    account: 0,
    change: 0,
    keyIndex: 3,
    derivationType: DerivationTypes.Peikert,
}

describe('parseAlgorandBip44Path', () => {
    test('parses a canonical Algorand BIP44 path with apostrophe hardening', () => {
        expect(parseAlgorandBip44Path("m/44'/283'/0'/0/3")).toEqual({
            account: 0,
            change: 0,
            keyIndex: 3,
        })
    })

    test('accepts the `h` hardened marker', () => {
        expect(parseAlgorandBip44Path('m/44h/283h/7h/1/9')).toEqual({
            account: 7,
            change: 1,
            keyIndex: 9,
        })
    })

    test('accepts the leading `m/` being omitted', () => {
        expect(parseAlgorandBip44Path("44'/283'/2'/0/0")).toEqual({
            account: 2,
            change: 0,
            keyIndex: 0,
        })
    })

    test('rejects paths with the wrong segment count', () => {
        expect(() => parseAlgorandBip44Path("m/44'/283'/0'")).toThrow(
            InvalidBip44PathError,
        )
    })

    test('rejects paths with a non-44 purpose', () => {
        expect(() => parseAlgorandBip44Path("m/49'/283'/0'/0/0")).toThrow(
            InvalidBip44PathError,
        )
    })

    test('rejects paths with a non-Algorand coin type', () => {
        expect(() => parseAlgorandBip44Path("m/44'/60'/0'/0/0")).toThrow(
            InvalidBip44PathError,
        )
    })

    test('rejects paths where the account segment is not hardened', () => {
        expect(() => parseAlgorandBip44Path("m/44'/283'/0/0/0")).toThrow(
            InvalidBip44PathError,
        )
    })

    test('rejects paths with non-integer segments', () => {
        expect(() => parseAlgorandBip44Path("m/44'/283'/foo'/0/0")).toThrow(
            InvalidBip44PathError,
        )
    })

    test('exposes the malformed reason on the thrown error', () => {
        try {
            parseAlgorandBip44Path('garbage')
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidBip44PathError)
            expect((error as InvalidBip44PathError).reason).toBe('malformed')
        }
    })
})

describe('hdPathMatchesDetails', () => {
    test('returns true for a matching path', () => {
        expect(hdPathMatchesDetails("m/44'/283'/0'/0/3", details)).toBe(true)
    })

    test('returns false for a mismatching keyIndex', () => {
        expect(hdPathMatchesDetails("m/44'/283'/0'/0/99", details)).toBe(false)
    })

    test('propagates malformed-path errors', () => {
        expect(() => hdPathMatchesDetails('bad', details)).toThrow(
            InvalidBip44PathError,
        )
    })
})

describe('assertAlgorandBip44PathMatches', () => {
    test('does not throw on match', () => {
        expect(() =>
            assertAlgorandBip44PathMatches("m/44'/283'/0'/0/3", details),
        ).not.toThrow()
    })

    test('throws mismatch error when coordinates differ', () => {
        try {
            assertAlgorandBip44PathMatches("m/44'/283'/0'/0/99", details)
            throw new Error('expected throw')
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidBip44PathError)
            expect((error as InvalidBip44PathError).reason).toBe('mismatch')
        }
    })

    test('throws malformed error for invalid paths', () => {
        try {
            assertAlgorandBip44PathMatches('nope', details)
            throw new Error('expected throw')
        } catch (error) {
            expect(error).toBeInstanceOf(InvalidBip44PathError)
            expect((error as InvalidBip44PathError).reason).toBe('malformed')
        }
    })
})

describe('ALGORAND_COIN_TYPE', () => {
    test('equals the SLIP-0044 constant', () => {
        expect(ALGORAND_COIN_TYPE).toBe(283)
    })
})
