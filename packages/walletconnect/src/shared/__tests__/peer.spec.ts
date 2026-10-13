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
import { toPeer } from '../peer'

describe('toPeer', () => {
    it('reads every field a well-formed peerMeta carries', () => {
        expect(
            toPeer({
                name: 'Tinyman',
                url: 'https://tinyman.org',
                description: 'AMM',
                icons: ['https://tinyman.org/icon.png'],
            }),
        ).toEqual({
            name: 'Tinyman',
            url: 'https://tinyman.org',
            description: 'AMM',
            icons: ['https://tinyman.org/icon.png'],
        })
    })

    it('trims the name and falls back to the url when the name is not a string', () => {
        expect(toPeer({ name: '  Padded  ' }).name).toBe('Padded')
        expect(toPeer({ name: 42, url: 'https://hostile.example' })).toEqual({
            name: 'https://hostile.example',
            url: 'https://hostile.example',
        })
    })

    it('names a peer with nothing usable rather than throwing', () => {
        expect(toPeer(null)).toEqual({ name: 'Unknown dApp' })
        expect(toPeer('peerMeta')).toEqual({ name: 'Unknown dApp' })
        expect(toPeer({ name: 42, url: 99, icons: 'not-an-array' })).toEqual({
            name: 'Unknown dApp',
        })
        expect(toPeer({ name: '   ', url: '' })).toEqual({
            name: 'Unknown dApp',
        })
    })

    it('drops non-string icons and keeps an explicitly empty list', () => {
        expect(
            toPeer({
                name: 'Peer',
                icons: ['https://p.example/i.png', 7, null, {}, ''],
            }).icons,
        ).toEqual(['https://p.example/i.png'])
        expect(toPeer({ name: 'Peer', icons: [] }).icons).toEqual([])
        expect(toPeer({ name: 'Peer' })).not.toHaveProperty('icons')
    })

    it('caps icons at eight so a hostile peer cannot bloat the record', () => {
        const icons = Array.from(
            { length: 12 },
            (_, index) => `https://p.example/${index}.png`,
        )

        expect(toPeer({ name: 'Peer', icons }).icons).toEqual(icons.slice(0, 8))
    })

    it('omits url and description that are not non-empty strings', () => {
        expect(
            toPeer({ name: 'Peer', url: '', description: { evil: true } }),
        ).toEqual({ name: 'Peer' })
    })
})
