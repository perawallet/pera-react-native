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

import { describe, it, expect } from 'vitest'
import { pseudolocalize, buildPseudoBundle } from '../pseudolocale'

describe('pseudolocalize', () => {
    it('accents ASCII letters so untranslated strings stand out', () => {
        const out = pseudolocalize('Send')

        expect(out).not.toContain('Send')
        expect(out).toContain('é')
    })

    it('maps every accented character 1:1, so no table entry can inflate length on its own', () => {
        const source = 'abcdefghijklmnopqrstuvwxyz'
        const out = pseudolocalize(source)
        // expand() always joins the accented text and its padding with a
        // literal space, and the source here has none, so splitting on the
        // first space isolates the accented portion from the padding.
        const accented = out.slice(1, -1).split(' ')[0]

        expect([...accented]).toHaveLength(source.length)
    })

    it('expands length by roughly 40% to exercise wrapping', () => {
        const source = 'Send funds to a recipient address'
        const out = pseudolocalize(source)

        expect(out.length).toBeGreaterThan(source.length * 1.3)
    })

    it('brackets the string to expose clipping at both ends', () => {
        const out = pseudolocalize('Send')

        expect(out.startsWith('[')).toBe(true)
        expect(out.endsWith(']')).toBe(true)
    })

    it('leaves {{param}} placeholders untouched', () => {
        const out = pseudolocalize('Sent to {{address}} now')

        expect(out).toContain('{{address}}')
    })

    it('leaves multiple placeholders untouched', () => {
        const out = pseudolocalize('{{threshold}} of {{participantCount}}')

        expect(out).toContain('{{threshold}}')
        expect(out).toContain('{{participantCount}}')
    })

    it('leaves $t() references untouched', () => {
        const out = pseudolocalize('See $t(common.terms) for detail')

        expect(out).toContain('$t(common.terms)')
    })
})

describe('buildPseudoBundle', () => {
    it('walks nested objects and transforms only string leaves', () => {
        const out = buildPseudoBundle({
            a: 'Send',
            b: { c: 'Receive', d: { e: 'Swap' } },
        }) as { a: string; b: { c: string; d: { e: string } } }

        expect(out.a).toContain('[')
        expect(out.b.c).toContain('[')
        expect(out.b.d.e).toContain('[')
    })

    it('preserves plural-suffixed keys so intl-pluralrules still resolves them', () => {
        const out = buildPseudoBundle({
            item_one: 'one item',
            item_other: '{{count}} items',
        }) as Record<string, string>

        expect(Object.keys(out).sort()).toEqual(['item_one', 'item_other'])
        expect(out.item_other).toContain('{{count}}')
    })
})
