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
import { isTypedDataV4Params } from '../typedDataVersion'

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const TYPED_DATA = {
    types: { EIP712Domain: [] },
    primaryType: 'EIP712Domain',
    domain: {},
    message: {},
}
const V1_ENTRIES = [{ type: 'string', name: 'Message', value: 'Hi' }]

describe('isTypedDataV4Params', () => {
    it.each([
        ['an [address, object] pair', [ADDRESS, TYPED_DATA]],
        [
            'an [address, JSON object string] pair',
            [ADDRESS, JSON.stringify(TYPED_DATA)],
        ],
        [
            'a JSON object string with leading whitespace',
            [ADDRESS, '  {"types":{}}'],
        ],
    ])('accepts %s', (_name, params) => {
        expect(isTypedDataV4Params(params)).toBe(true)
    })

    it.each([
        ['v1 [array, address]', [V1_ENTRIES, ADDRESS]],
        ['[address, array]', [ADDRESS, V1_ENTRIES]],
        ['a JSON array string first', [JSON.stringify(V1_ENTRIES), ADDRESS]],
        ['a JSON array string second', [ADDRESS, JSON.stringify(V1_ENTRIES)]],
        ['an empty array', []],
        ['a missing payload', [ADDRESS]],
        ['a null payload', [ADDRESS, null]],
        ['a non-JSON string', [ADDRESS, 'not json']],
        ['undefined', undefined],
        ['a bare object', {}],
    ])('rejects %s', (_name, params) => {
        expect(isTypedDataV4Params(params)).toBe(false)
    })
})
