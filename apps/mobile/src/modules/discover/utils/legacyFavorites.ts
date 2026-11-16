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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { webViewScript } from '@modules/webview'
import { normalizeDappUrl } from './normalizeDappUrl'

/** A favorite as the legacy Discover web app stored it, validated. */
export type LegacyFavorite = {
    url: string
    name: string
    logo: Nullable<string>
    categories: string[]
}

export const LEGACY_FAVORITES_MESSAGE_TYPE = 'discover-legacy-favorites'

/** The web app caps its favorites list at this length. */
export const LEGACY_FAVORITES_MAX = 500

/**
 * Runs in a hidden WebView on the Discover origin. Reads the web app's
 * favorites the way its boot does (`useSetFavorites`): the older
 * `browserFavorites` key first, then `browser-favorites` entries whose url is
 * new. Unreadable storage posts `favorites: null`, which fails the attempt.
 */
export const legacyFavoritesReaderScript = webViewScript`
(function () {
    var read = function (key) {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return [];
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('not a list');
        return parsed;
    };
    var favorites;
    try {
        var legacy = read('browserFavorites');
        var current = read('browser-favorites');
        favorites = legacy.slice();
        current.forEach(function (entry) {
            var known = legacy.some(function (old) {
                return old && entry && old.url === entry.url;
            });
            if (!known) favorites.push(entry);
        });
    } catch (error) {
        favorites = null;
    }
    window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: ${LEGACY_FAVORITES_MESSAGE_TYPE}, favorites: favorites })
    );
})();
true;
`

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const toLegacyFavorite = (raw: unknown): Nullable<LegacyFavorite> => {
    if (!isRecord(raw)) return null
    const { url, name, logo, categories } = raw
    if (typeof url !== 'string' || normalizeDappUrl(url) === null) return null
    if (typeof name !== 'string' || name.trim().length === 0) return null
    return {
        url,
        name,
        logo: typeof logo === 'string' ? logo : null,
        categories: Array.isArray(categories)
            ? categories.flatMap(category =>
                  isRecord(category) && typeof category.title === 'string'
                      ? [category.title]
                      : [],
              )
            : [],
    }
}

/**
 * The reader script's message, validated. Null when it is not that message or
 * its list is missing; invalid entries and those past the cap are counted in
 * `skipped`, never dropped silently.
 */
export const parseLegacyFavoritesMessage = (
    data: unknown,
): Nullable<{ entries: LegacyFavorite[]; skipped: number }> => {
    if (!isRecord(data) || data.type !== LEGACY_FAVORITES_MESSAGE_TYPE) {
        return null
    }
    if (!Array.isArray(data.favorites)) return null
    const considered = data.favorites.slice(0, LEGACY_FAVORITES_MAX)
    const entries = considered.flatMap(raw => {
        const favorite = toLegacyFavorite(raw)
        return favorite ? [favorite] : []
    })
    return {
        entries,
        skipped: data.favorites.length - entries.length,
    }
}
