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
import {
    hasUnreadableTypedDataValue,
    readTypedDataInteger,
} from '../typedDataValues'
import {
    DAI_PERMIT_TYPED_DATA,
    EIP2612_PERMIT_TYPED_DATA,
    ERC721_PERMIT_TYPED_DATA,
    MAIL_TYPED_DATA,
    PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA,
    PERMIT2_BATCH_TYPED_DATA,
    PERMIT2_BATCH_WITNESS_TRANSFER_FROM_TYPED_DATA,
    PERMIT2_SINGLE_TYPED_DATA,
    PERMIT2_TRANSFER_FROM_TYPED_DATA,
    PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA,
    PERMIT_SPENDER,
} from './fixtures'

// A deep copy, so a vector can edit the fixture it starts from.
const edit = <T>(fixture: T, change: (copy: any) => void): T => {
    const copy = structuredClone(fixture)
    change(copy)
    return copy
}

describe('readTypedDataInteger', () => {
    it.each([
        [1000000n, 1000000n],
        [1000000, 1000000n],
        [1e18, 10n ** 18n],
        ['1000000', 1000000n],
        ['0xf4240', 1000000n],
        ['-5', -5n],
    ])('reads %s as an integer', (value, expected) => {
        expect(readTypedDataInteger(value)).toBe(expected)
    })

    it.each([
        [['1000000']],
        [[['1']]],
        [[]],
        [true],
        [''],
        ['  '],
        [1.5],
        [null],
        [undefined],
        [{}],
        ['abc'],
    ])('leaves %j unread', value => {
        expect(readTypedDataInteger(value)).toBeUndefined()
    })
})

describe('hasUnreadableTypedDataValue', () => {
    it.each([
        ['mail', MAIL_TYPED_DATA],
        ['EIP-2612', EIP2612_PERMIT_TYPED_DATA],
        ['DAI', DAI_PERMIT_TYPED_DATA],
        ['ERC-721', ERC721_PERMIT_TYPED_DATA],
        ['PermitSingle', PERMIT2_SINGLE_TYPED_DATA],
        ['PermitBatch', PERMIT2_BATCH_TYPED_DATA],
        ['PermitTransferFrom', PERMIT2_TRANSFER_FROM_TYPED_DATA],
        ['PermitBatchTransferFrom', PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA],
        ['PermitWitnessTransferFrom', PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA],
        [
            'PermitBatchWitnessTransferFrom',
            PERMIT2_BATCH_WITNESS_TRANSFER_FROM_TYPED_DATA,
        ],
    ])('accepts the well-formed %s document', (_name, typed) => {
        expect(hasUnreadableTypedDataValue(typed)).toBe(false)
    })

    it.each([
        [
            'a top-level integer',
            edit(EIP2612_PERMIT_TYPED_DATA, copy => {
                copy.message.value = ['1000000']
            }),
        ],
        [
            'a nested struct integer',
            edit(PERMIT2_SINGLE_TYPED_DATA, copy => {
                copy.message.details.amount = ['1000000']
            }),
        ],
        [
            'a struct inside an array',
            edit(PERMIT2_BATCH_TYPED_DATA, copy => {
                copy.message.details[1].expiration = ['1772409600']
            }),
        ],
        [
            'an item of an integer array',
            {
                ...MAIL_TYPED_DATA,
                types: { Order: [{ name: 'amounts', type: 'uint256[]' }] },
                primaryType: 'Order',
                message: { amounts: ['1', [['1']]] },
            },
        ],
        [
            'a declared EIP712Domain integer',
            {
                ...MAIL_TYPED_DATA,
                types: {
                    ...MAIL_TYPED_DATA.types,
                    EIP712Domain: [{ name: 'chainId', type: 'uint256' }],
                },
                domain: { chainId: ['1'] },
            },
        ],
        [
            'a wrapped bool',
            edit(DAI_PERMIT_TYPED_DATA, copy => {
                copy.message.allowed = [true]
            }),
        ],
        [
            'a wrapped address',
            edit(EIP2612_PERMIT_TYPED_DATA, copy => {
                copy.message.spender = [PERMIT_SPENDER]
            }),
        ],
        [
            'a struct-typed field holding a string',
            edit(MAIL_TYPED_DATA, copy => {
                copy.message.from = 'Cow'
            }),
        ],
        [
            'a wrapped item under a non-standard array suffix',
            {
                ...MAIL_TYPED_DATA,
                types: { Order: [{ name: 'amounts', type: 'uint256[x]' }] },
                primaryType: 'Order',
                message: { amounts: [['5'], true, ''] },
            },
        ],
        [
            'a struct item under a non-standard array suffix',
            {
                ...MAIL_TYPED_DATA,
                types: {
                    Order: [{ name: 'legs', type: 'Leg[x]' }],
                    Leg: [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' },
                    ],
                },
                primaryType: 'Order',
                message: {
                    legs: [{ spender: PERMIT_SPENDER, amount: ['5'] }],
                },
            },
        ],
        [
            'an integer under a non-standard size',
            {
                ...MAIL_TYPED_DATA,
                types: { Order: [{ name: 'amount', type: 'uint7' }] },
                primaryType: 'Order',
                message: { amount: [5] },
            },
        ],
        [
            'a struct declared under an array-looking name',
            {
                ...MAIL_TYPED_DATA,
                types: {
                    Order: [{ name: 'leg', type: 'Leg[1]' }],
                    'Leg[1]': [
                        { name: 'spender', type: 'address' },
                        { name: 'amount', type: 'uint256' },
                    ],
                },
                primaryType: 'Order',
                message: { leg: { spender: PERMIT_SPENDER, amount: '5' } },
            },
        ],
        [
            'a field whose name is not a string',
            {
                ...MAIL_TYPED_DATA,
                types: { Order: [{ name: 0, type: 'uint256' }] },
                primaryType: 'Order',
                message: { '0': true },
            },
        ],
        [
            'a field entry that is not a record',
            {
                ...MAIL_TYPED_DATA,
                types: { Order: [null] },
                primaryType: 'Order',
                message: {},
            },
        ],
        [
            'a struct-typed field holding an array',
            {
                ...MAIL_TYPED_DATA,
                types: {
                    Order: [{ name: 'note', type: 'Note' }],
                    Note: [{ name: 'text', type: 'string' }],
                },
                primaryType: 'Order',
                message: { note: [] },
            },
        ],
        [
            'an array-typed field holding a string',
            edit(PERMIT2_BATCH_TYPED_DATA, copy => {
                copy.message.details = 'none'
            }),
        ],
    ])('flags %s', (_name, typed) => {
        expect(hasUnreadableTypedDataValue(typed)).toBe(true)
    })

    it('does not judge a string field holding a number', () => {
        const typed = edit(MAIL_TYPED_DATA, copy => {
            copy.message.contents = 5
        })

        expect(hasUnreadableTypedDataValue(typed)).toBe(false)
    })

    it.each([[{ types: 'x' }], [{ types: {} }], [null], ['x']])(
        'leaves the structure of %j to the readers that refuse it',
        typed => {
            expect(hasUnreadableTypedDataValue(typed)).toBe(false)
        },
    )

    it('flags a document whose types getter throws', () => {
        const typed = {
            primaryType: 'Mail',
            get types(): never {
                throw new Error('hostile getter')
            },
        }

        expect(hasUnreadableTypedDataValue(typed)).toBe(true)
    })

    it('flags a document that throws while it is read', () => {
        const typed = structuredClone(EIP2612_PERMIT_TYPED_DATA)
        Object.defineProperty(typed.message, 'value', {
            get: () => {
                throw new Error('hostile getter')
            },
        })

        expect(hasUnreadableTypedDataValue(typed)).toBe(true)
    })
})
