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
import { decodeRecap, isRecapUri } from '../recap'

const recapOf = (payload: unknown) =>
    `urn:recap:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`

describe('isRecapUri', () => {
    it.each([
        ['urn:recap:eyJhdHQiOnt9fQ', true],
        ['URN:ReCap:eyJhdHQiOnt9fQ', true],
        ['https://example.com/urn:recap:x', false],
        ['ipfs://bafy', false],
    ])('reads %s as a ReCap: %s', (uri, expected) => {
        expect(isRecapUri(uri)).toBe(expected)
    })
})

describe('decodeRecap', () => {
    it('lists the abilities granted on each target', () => {
        expect(
            decodeRecap(
                recapOf({
                    att: {
                        'https://example.com/pictures/': {
                            'crud/delete': [{}],
                            'crud/update': [{}],
                        },
                        'mailto:user@example.com': { 'msg/send': [{}] },
                    },
                    prf: [],
                }),
            ),
        ).toEqual([
            {
                target: 'https://example.com/pictures/',
                abilities: ['crud/delete', 'crud/update'],
            },
            { target: 'mailto:user@example.com', abilities: ['msg/send'] },
        ])
    })

    it('decodes base64url that needs padding restored', () => {
        const uri = recapOf({ att: { 'https://a.b': { 'x/y': [{}] } } })
        expect(uri.endsWith('=')).toBe(false)
        expect(decodeRecap(uri)).toHaveLength(1)
    })

    it('decodes padded, standard-alphabet base64', () => {
        const target = 'https://a.b/?>~'
        const encoded = Buffer.from(
            JSON.stringify({ att: { [target]: { 'x/y': [{}] } } }),
        ).toString('base64')
        expect(encoded).toMatch(/\+.*==$/)
        expect(decodeRecap(`urn:recap:${encoded}`)).toEqual([
            { target, abilities: ['x/y'] },
        ])
    })

    it.each([
        ['a URI that is not a ReCap', 'https://example.com'],
        ['text that is not base64url', 'urn:recap:not base64!'],
        [
            'base64url that is not JSON',
            `urn:recap:${Buffer.from('nope').toString('base64url')}`,
        ],
        ['JSON without an att map', recapOf({ prf: [] })],
        ['an att map with no grants', recapOf({ att: {} })],
        ['a target with no abilities', recapOf({ att: { 'https://a.b': {} } })],
        [
            'a target whose abilities are not a map',
            recapOf({ att: { 'https://a.b': ['crud/read'] } }),
        ],
        [
            'a target with a right-to-left override',
            recapOf({ att: { 'https://a.b‮': { 'x/y': [{}] } } }),
        ],
        [
            'an ability with a zero-width character',
            recapOf({ att: { 'https://a.b': { 'x/​y': [{}] } } }),
        ],
    ])('cannot read %s', (_label, uri) => {
        expect(decodeRecap(uri)).toBeUndefined()
    })
})
