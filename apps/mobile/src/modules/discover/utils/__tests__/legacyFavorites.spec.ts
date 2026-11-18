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
    isLegacyFavoritesMessage,
    LEGACY_FAVORITES_MAX,
    LEGACY_FAVORITES_MESSAGE_TYPE,
    legacyFavoritesReaderScript,
    parseLegacyFavoritesMessage,
} from '../legacyFavorites'

const message = (favorites: unknown, unreadableKeys = 0) => ({
    type: LEGACY_FAVORITES_MESSAGE_TYPE,
    favorites,
    unreadableKeys,
})

/** Runs the injected script against a fake page and returns what it posted. */
const runReaderScript = (
    storage: Record<string, string>,
    getItem: (key: string) => string | null = key => storage[key] ?? null,
): unknown => {
    const posted: string[] = []
    const window = {
        localStorage: { getItem },
        ReactNativeWebView: {
            postMessage: (data: string) => posted.push(data),
        },
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('window', legacyFavoritesReaderScript)(window)
    expect(posted).toHaveLength(1)
    return JSON.parse(posted[0] as string)
}

describe('parseLegacyFavoritesMessage', () => {
    it('keeps valid entries in order and maps categories to titles', () => {
        const result = parseLegacyFavoritesMessage(
            message([
                {
                    name: 'A',
                    url: 'https://a.io',
                    logo: 'https://a.io/l.png',
                    categories: [{ id: '1', title: 'DeFi' }],
                },
                { name: 'B', url: 'https://b.io', logo: null },
            ]),
        )

        expect(result).toEqual({
            entries: [
                {
                    url: 'https://a.io',
                    name: 'A',
                    logo: 'https://a.io/l.png',
                    categories: ['DeFi'],
                },
                { url: 'https://b.io', name: 'B', logo: null, categories: [] },
            ],
            skipped: 0,
            unreadableKeys: 0,
        })
    })

    it('skips entries without an https url or a name and counts them', () => {
        const result = parseLegacyFavoritesMessage(
            message([
                { name: 'X', url: 'http://x.io', logo: null },
                { name: '', url: 'https://y.io', logo: null },
                'str',
                null,
            ]),
        )

        expect(result).toEqual({ entries: [], skipped: 4, unreadableKeys: 0 })
    })

    it('passes the unreadable key count through, 0 when absent or invalid', () => {
        expect(
            parseLegacyFavoritesMessage(message([], 1))?.unreadableKeys,
        ).toBe(1)
        expect(
            parseLegacyFavoritesMessage({
                type: LEGACY_FAVORITES_MESSAGE_TYPE,
                favorites: [],
            })?.unreadableKeys,
        ).toBe(0)
        expect(
            parseLegacyFavoritesMessage(message([], -1 as number))
                ?.unreadableKeys,
        ).toBe(0)
    })

    it('turns a non-string logo into null', () => {
        const result = parseLegacyFavoritesMessage(
            message([{ name: 'A', url: 'https://a.io', logo: 42 }]),
        )

        expect(result?.entries[0]?.logo).toBeNull()
    })

    it(`considers only the first ${LEGACY_FAVORITES_MAX} entries`, () => {
        const many = Array.from(
            { length: LEGACY_FAVORITES_MAX + 1 },
            (_, i) => ({
                name: `D${i}`,
                url: `https://d${i}.io`,
                logo: null,
            }),
        )

        const result = parseLegacyFavoritesMessage(message(many))

        expect(result?.entries).toHaveLength(LEGACY_FAVORITES_MAX)
        expect(result?.skipped).toBe(1)
    })

    it('returns null for a wrong type or a non-array favorites', () => {
        expect(
            parseLegacyFavoritesMessage({ type: 'x', favorites: [] }),
        ).toBeNull()
        expect(parseLegacyFavoritesMessage(message(null))).toBeNull()
        expect(parseLegacyFavoritesMessage('nope')).toBeNull()
        expect(parseLegacyFavoritesMessage(undefined)).toBeNull()
    })
})

describe('isLegacyFavoritesMessage', () => {
    it("is true only for the reader's message type", () => {
        expect(isLegacyFavoritesMessage(message(null))).toBe(true)
        expect(isLegacyFavoritesMessage({ type: 'bridge', id: 1 })).toBe(false)
        expect(isLegacyFavoritesMessage('nope')).toBe(false)
        expect(isLegacyFavoritesMessage(undefined)).toBe(false)
    })
})

describe('legacyFavoritesReaderScript', () => {
    const a = { name: 'A', url: 'https://a.io', logo: null }
    const b = { name: 'B', url: 'https://b.io', logo: null }
    const aNewer = { name: 'A new', url: 'https://a.io', logo: null }

    it('posts the current key when there is no legacy key', () => {
        expect(
            runReaderScript({ 'browser-favorites': JSON.stringify([a, b]) }),
        ).toEqual(message([a, b]))
    })

    it('puts legacy entries first and drops newer ones with the same url', () => {
        expect(
            runReaderScript({
                browserFavorites: JSON.stringify([a]),
                'browser-favorites': JSON.stringify([aNewer, b]),
            }),
        ).toEqual(message([a, b]))
    })

    it('posts an empty list when nothing is stored', () => {
        expect(runReaderScript({})).toEqual(message([]))
    })

    it('keeps the readable key and counts the broken one', () => {
        expect(
            runReaderScript({
                browserFavorites: '{oops',
                'browser-favorites': JSON.stringify([b]),
            }),
        ).toEqual(message([b], 1))
        expect(
            runReaderScript({
                browserFavorites: JSON.stringify([a]),
                'browser-favorites': JSON.stringify({ not: 'a list' }),
            }),
        ).toEqual(message([a], 1))
    })

    it('posts null favorites only when no key can be read', () => {
        expect(
            runReaderScript({}, () => {
                throw new Error('storage blocked')
            }),
        ).toEqual(message(null, 2))
    })
})
