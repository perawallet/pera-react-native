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

// No runtime imports: injected-scripts.ts calls the tag at import time, and
// specs load this module under partial package mocks.

/** Script source in which every data value was encoded by {@link webViewScript}. */
export type WebViewScript = string & { readonly __webViewScript: unique symbol }

// Every one of these can only occur inside a JSON string, so escaping it leaves
// the decoded value unchanged. They keep `</script>` and `<!--` inert in an HTML
// context and keep line terminators out of the source. A double quote is left
// alone because the encoded value is itself a JSON string, so wrapping an
// interpolation in quotes is unsafe; the lint rule rejects it.
const UNSAFE_IN_SOURCE = /[<>&'`$\u2028\u2029]/g

const toUnicodeEscape = (char: string): string =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`

const encodeScriptValue = (value: unknown): string =>
    (JSON.stringify(value) ?? 'undefined').replace(
        UNSAFE_IN_SOURCE,
        toUnicodeEscape,
    )

const brand = (source: string): WebViewScript =>
    // oxlint-disable-next-line pera/webview-injection-serializer -- the serializer is the one place a WebViewScript is minted
    source as WebViewScript

/**
 * Tag for scripts injected into a WebView, which run with the page's
 * privileges. Static parts are emitted as written; each `${value}` becomes an
 * encoded JS expression, so write it bare, never inside quotes.
 */
export const webViewScript = (
    code: TemplateStringsArray,
    ...values: readonly unknown[]
): WebViewScript => {
    // An invalid escape (e.g. a regex backreference `\1`) cooks to undefined,
    // which would silently drop the part.
    if (code.some(part => part === undefined)) {
        throw new Error('webViewScript: a static part has an invalid escape')
    }
    return brand(
        code.reduce(
            (source, part, index) =>
                source + encodeScriptValue(values[index - 1]) + part,
        ),
    )
}

/** Joins with a newline so no part can run into the next one (ASI). */
export const joinWebViewScripts = (
    ...scripts: readonly (WebViewScript | undefined)[]
): WebViewScript =>
    brand(scripts.filter(script => script !== undefined).join('\n'))
