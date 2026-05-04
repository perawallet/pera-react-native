/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect } from 'vitest'
import { validateArc0001SignTxnParams } from '../arc0001'

const VALID_ADDRESS_A =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
const VALID_ADDRESS_B =
    '7777777777777777777777777777777777777777777777777774MSJUVU'

describe('validateArc0001SignTxnParams', () => {
    it('returns null when params are empty', () => {
        expect(validateArc0001SignTxnParams([])).toBeNull()
    })

    it('returns null when authAddr and signers are absent', () => {
        expect(validateArc0001SignTxnParams([{}, {}])).toBeNull()
    })

    it('returns null when authAddr is a valid Algorand address', () => {
        expect(
            validateArc0001SignTxnParams([{ authAddr: VALID_ADDRESS_A }]),
        ).toBeNull()
    })

    it('returns null when signers is empty (means do not sign per ARC-0001)', () => {
        expect(validateArc0001SignTxnParams([{ signers: [] }])).toBeNull()
    })

    it('returns null when every signers entry is a valid address', () => {
        expect(
            validateArc0001SignTxnParams([
                { signers: [VALID_ADDRESS_A, VALID_ADDRESS_B] },
            ]),
        ).toBeNull()
    })

    it('flags an invalid authAddr with the offending index', () => {
        const result = validateArc0001SignTxnParams([
            {},
            { authAddr: 'INVALID_ADDRESS' },
        ])
        expect(result).not.toBeNull()
        expect(result?.field).toBe('authAddr')
        expect(result?.index).toBe(1)
    })

    it('flags an invalid signers entry with the offending index', () => {
        const result = validateArc0001SignTxnParams([
            { signers: [VALID_ADDRESS_A] },
            { signers: ['INVALID_ADDRESS'] },
        ])
        expect(result).not.toBeNull()
        expect(result?.field).toBe('signers')
        expect(result?.index).toBe(1)
    })

    it('flags authAddr before signers when both are bad on the same entry', () => {
        const result = validateArc0001SignTxnParams([
            {
                authAddr: 'NOT_AN_ADDRESS',
                signers: ['ALSO_NOT_AN_ADDRESS'],
            },
        ])
        expect(result?.field).toBe('authAddr')
    })

    it('treats an empty-string authAddr as invalid', () => {
        const result = validateArc0001SignTxnParams([{ authAddr: '' }])
        expect(result?.field).toBe('authAddr')
    })
})
