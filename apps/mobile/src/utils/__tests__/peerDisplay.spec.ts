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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
    PEER_TEXT_MAX_LENGTH,
    toPeerDisplayText,
    toPeerHostLabel,
} from '../peerDisplay'

describe('toPeerDisplayText', () => {
    it('strips bidi overrides, isolates and marks', () => {
        expect(
            toPeerDisplayText('Pera\u202Etellaw\u202C \u2066x\u2069\u200F'),
        ).toBe('Peratellaw x')
    })

    it('collapses newlines and runs of whitespace to one line', () => {
        expect(toPeerDisplayText('  Tiny\n\n  man\t ')).toBe('Tiny man')
    })

    it('clamps an oversized name with an ellipsis', () => {
        const result = toPeerDisplayText('a'.repeat(500))

        expect(Array.from(result)).toHaveLength(PEER_TEXT_MAX_LENGTH)
        expect(result.endsWith('…')).toBe(true)
    })

    it('counts code points, so an emoji is never split in half', () => {
        const result = toPeerDisplayText('😀'.repeat(10), 5)

        expect(result).toBe('😀😀😀😀…')
    })

    it('returns an empty string for a missing value', () => {
        expect(toPeerDisplayText(undefined)).toBe('')
    })
})

describe('toPeerHostLabel', () => {
    it('shows only the host, without scheme or path', () => {
        expect(toPeerHostLabel('https://app.tinyman.org/swap?x=1')).toBe(
            'app.tinyman.org',
        )
    })

    it('shows a homoglyph host in its punycode form', () => {
        expect(toPeerHostLabel('https://\u0430pple.com')).toBe(
            'xn--pple-43d.com',
        )
    })

    it('keeps a non-default port', () => {
        expect(toPeerHostLabel('http://localhost:3000/')).toBe('localhost:3000')
    })

    it('falls back to the cleaned raw value when the url does not parse', () => {
        expect(toPeerHostLabel('not a url\u202E')).toBe('not a url')
    })

    it('returns undefined for a missing url', () => {
        expect(toPeerHostLabel(undefined)).toBeUndefined()
        expect(toPeerHostLabel('')).toBeUndefined()
    })
})
