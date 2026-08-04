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

const ACCENTS: Record<string, string> = {
    a: 'á',
    b: 'ƀ',
    c: 'ç',
    d: 'ð',
    e: 'é',
    f: 'ƒ',
    g: 'ĝ',
    h: 'ĥ',
    i: 'í',
    j: 'ĵ',
    k: 'ķ',
    l: 'ĺ',
    m: 'ɱ',
    n: 'ñ',
    o: 'ó',
    p: 'ƥ',
    q: 'ɋ',
    r: 'ŕ',
    s: 'š',
    t: 'ţ',
    u: 'ú',
    v: 'ṽ',
    w: 'ŵ',
    x: 'х',
    y: 'ý',
    z: 'ž',
}

// Segments that must survive verbatim: i18next interpolation and $t() refs.
// Accenting inside either breaks resolution and renders literal syntax to the
// user, so the transform is applied only to the text between them.
//
// The capturing group makes String.split keep these segments in the output.
const PRESERVED = /(\{\{[^}]*\}\}|\$t\([^)]*\))/g

// Identified by prefix rather than by re-testing PRESERVED: that regex carries
// the `g` flag, and RegExp.test on a global regex advances lastIndex, so
// testing repeatedly inside a map would skip matches non-deterministically.
//
// Checked as an anchored regex rather than a quoted startsWith argument: the
// i18n lint's call-site scanner greps source for the letter t, an open paren,
// then a quote character, and a quoted dollar-sign-t-open-paren prefix ending
// right before its own closing quote matches that shape, so it misreads this
// line as a translation call.
const DOLLAR_T_PREFIX = /^\$t\(/

const isPreserved = (segment: string): boolean =>
    segment.startsWith('{{') || DOLLAR_T_PREFIX.test(segment)

const accent = (text: string): string =>
    [...text]
        .map(char => {
            const lower = char.toLowerCase()
            const mapped = ACCENTS[lower]
            if (mapped === undefined) return char
            return char === lower ? mapped : mapped.toUpperCase()
        })
        .join('')

// Padding goes inside the brackets rather than appended, so wrapping is
// exercised the way a real long translation would exercise it.
const PAD = 'åéîøü'

const expand = (text: string): string => {
    const extra = Math.ceil(text.length * 0.4)
    if (extra === 0) return text
    let pad = ''
    while (pad.length < extra) pad += PAD
    return `${text} ${pad.slice(0, extra)}`
}

export const pseudolocalize = (value: string): string => {
    const transformed = value
        .split(PRESERVED)
        .map(segment => (isPreserved(segment) ? segment : accent(segment)))
        .join('')
    return `[${expand(transformed)}]`
}

export const buildPseudoBundle = (
    source: Record<string, unknown>,
): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(source)) {
        if (typeof value === 'string') {
            out[key] = pseudolocalize(value)
        } else if (typeof value === 'object' && value !== null) {
            out[key] = buildPseudoBundle(value as Record<string, unknown>)
        } else {
            out[key] = value
        }
    }
    return out
}
