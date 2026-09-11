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
    isWalletConnectFocusHint,
    isWalletConnectScheme,
    parseWalletConnectUri,
} from '../deeplink'

describe('WalletConnect deep-link parser', () => {
    describe('parseWalletConnectUri', () => {
        it('returns null for invalid scheme', () => {
            expect(parseWalletConnectUri('invalid:test')).toBeNull()
        })

        it('parses valid wc: URI', () => {
            const uri = 'wc:test@1?bridge=test&key=test'

            expect(parseWalletConnectUri(uri)).toEqual({
                uri,
                browserName: undefined,
            })
        })

        it('lowercases only the scheme', () => {
            expect(
                parseWalletConnectUri(' WC:Test@1?bridge=Test&key=K ')?.uri,
            ).toBe('wc:Test@1?bridge=Test&key=K')
        })

        it('parses and normalizes perawallet-wc: URI', () => {
            expect(
                parseWalletConnectUri(
                    'perawallet-wc:test@1?bridge=test&key=test',
                )?.uri,
            ).toBe('wc:test@1?bridge=test&key=test')
        })

        it('rejects wrapper that unwraps to a non-wc scheme', () => {
            expect(
                parseWalletConnectUri(
                    'perawallet-wc://wc?uri=javascript%3Aalert(1)',
                ),
            ).toBeNull()
            expect(
                parseWalletConnectUri('wc://wc?uri=https%3A%2F%2Fevil.example'),
            ).toBeNull()
        })

        it('rejects wrapper with malformed percent-encoding', () => {
            expect(
                parseWalletConnectUri('perawallet-wc://wc?uri=%E0%A4%A'),
            ).toBeNull()
        })

        it('unwraps a valid encoded wc: URI in the wrapper', () => {
            const inner = 'wc:test@1?bridge=test&key=test'
            const wrapped =
                'perawallet-wc://wc?uri=' + encodeURIComponent(inner)

            expect(parseWalletConnectUri(wrapped)?.uri).toBe(inner)
        })

        it('rejects a return-to-wallet focus hint, which names no pairing at all', () => {
            // dApps emit signals like `wc://?browser=...` to bring the wallet
            // to the foreground. The request rides the already-open socket, so
            // this must stay silent rather than surface as a failed pairing.
            expect(
                parseWalletConnectUri('wc://?browser=Android%20Browser'),
            ).toBeNull()
        })

        it('parses a v2 pairing URI, which carries a symKey and no bridge', () => {
            const uri = `wc:${'c'.repeat(64)}@2?relay-protocol=irn&symKey=${'d'.repeat(64)}`
            expect(parseWalletConnectUri(uri)?.uri).toBe(uri)
        })

        it('parses a bridge-less v1 URI and leaves the protocol check to the handler', () => {
            // Which params a pairing URI needs is per-protocol, so the parser
            // only owns URL shape: `canHandleUri` claims it or nobody does,
            // and an unclaimed URI becomes the failed-pairing toast.
            expect(parseWalletConnectUri('wc:test@1?key=test')?.uri).toBe(
                'wc:test@1?key=test',
            )
            expect(
                parseWalletConnectUri('wc:test@1?bridge=&key=test')?.uri,
            ).toBe('wc:test@1?bridge=&key=test')
        })

        it('parses and normalizes algorand-wc: URI', () => {
            expect(
                parseWalletConnectUri('algorand-wc:test@1?bridge=test&key=test')
                    ?.uri,
            ).toBe('wc:test@1?bridge=test&key=test')
        })

        it('unwraps a valid encoded wc: URI in an algorand-wc wrapper', () => {
            const inner = 'wc:test@1?bridge=test&key=test'
            const wrapped = 'algorand-wc://wc?uri=' + encodeURIComponent(inner)

            expect(parseWalletConnectUri(wrapped)?.uri).toBe(inner)
        })

        it('unwraps a valid encoded wc: URI in the legacy algorand://wc wrapper', () => {
            const inner = 'wc:test@1?bridge=test&key=test'

            expect(
                parseWalletConnectUri(
                    'algorand://wc?uri=' + encodeURIComponent(inner),
                )?.uri,
            ).toBe(inner)
        })

        it('rejects an algorand://wc wrapper that unwraps to a non-wc scheme', () => {
            expect(
                parseWalletConnectUri(
                    'algorand://wc?uri=' +
                        encodeURIComponent('javascript:alert(1)'),
                ),
            ).toBeNull()
        })

        it('returns null for a plain algorand:// link with no uri param', () => {
            expect(
                parseWalletConnectUri('algorand://wc?browser=chrome'),
            ).toBeNull()
        })

        it('returns null for an ARC-90 algorand:// payment link', () => {
            expect(
                parseWalletConnectUri(
                    'algorand://GYBK7O4DIDJKR2G5PCSTQDNI2NUIC7DXNZ25M2UN4WBMJH77QSFHU7IVPU?amount=1000000',
                ),
            ).toBeNull()
        })

        it('normalizes a bridge-less algorand-wc: URI instead of dropping it', () => {
            expect(
                parseWalletConnectUri('algorand-wc:test@1?key=test')?.uri,
            ).toBe('wc:test@1?key=test')
        })
    })

    describe('classification helpers', () => {
        it('isWalletConnectScheme recognizes every WC scheme and nothing else', () => {
            expect(isWalletConnectScheme('wc:t@1?bridge=x&key=y')).toBe(true)
            expect(isWalletConnectScheme('perawallet-wc://wc?uri=x')).toBe(true)
            expect(isWalletConnectScheme('algorand-wc:t@1?key=y')).toBe(true)
            expect(isWalletConnectScheme('algorand://wc?uri=x')).toBe(true)
            expect(isWalletConnectScheme('algorand://ADDR?amount=1')).toBe(
                false,
            )
            expect(isWalletConnectScheme('perawallet://app/home')).toBe(false)
            expect(isWalletConnectScheme('https://perawallet.app')).toBe(false)
        })

        it('isWalletConnectFocusHint matches only bridge-less topic-less focus signals', () => {
            expect(
                isWalletConnectFocusHint('wc://?browser=Android%20Browser'),
            ).toBe(true)
            expect(
                isWalletConnectFocusHint('perawallet-wc://?browser=chrome'),
            ).toBe(true)
            // A topic@version segment marks a failed pairing, not a hint.
            expect(
                isWalletConnectFocusHint(
                    'wc:abc@2?relay-protocol=irn&symKey=ff',
                ),
            ).toBe(false)
            expect(isWalletConnectFocusHint('wc:t@1?key=y')).toBe(false)
            // A mangled wrapper still names a uri=, so it is a failed pairing too.
            expect(
                isWalletConnectFocusHint('perawallet-wc://wc?uri=%E0%A4%A'),
            ).toBe(false)
            expect(isWalletConnectFocusHint('perawallet://app/home')).toBe(
                false,
            )
        })
    })

    describe('partially-encoded wrapper URIs', () => {
        it('keeps the key param of an unencoded inner URI instead of truncating at the first &', () => {
            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=wc:t@1?bridge=https://bridge.example&key=abc',
            )

            expect(result?.uri).toBe(
                'wc:t@1?bridge=https://bridge.example&key=abc',
            )
        })

        it('strips known wrapper params appended after an unencoded inner URI', () => {
            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=wc:t@1?bridge=https://bridge.example&key=abc&browser=Safari&singleAccount=true&selectedAccount=X',
            )

            expect(result?.uri).toBe(
                'wc:t@1?bridge=https://bridge.example&key=abc',
            )
            expect(result?.browserName).toBe('Safari')
        })

        it('takes the first uri param when a link repeats it', () => {
            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=wc:first@1?bridge=https://bridge.example&uri=wc:second@1?bridge=https://evil.example',
            )

            expect(result?.uri).toBe(
                'wc:first@1?bridge=https://bridge.example&uri=wc:second@1?bridge=https://evil.example',
            )
        })

        it('rejects a link padded with thousands of repeated wrapper params', () => {
            const padded =
                'perawallet-wc://wc?' +
                '&uri=a'.repeat(5000) +
                '&browser=x'.repeat(5000)

            expect(parseWalletConnectUri(padded)).toBeNull()
        })

        it('keeps a fully-encoded inner URI byte-identical when wrapper params follow', () => {
            const inner = 'wc:t@1?bridge=https://bridge.example&key=abc'

            const result = parseWalletConnectUri(
                'perawallet-wc://wc?uri=' +
                    encodeURIComponent(inner) +
                    '&browser=chrome',
            )

            expect(result?.uri).toBe(inner)
            expect(result?.browserName).toBe('chrome')
        })
    })

    describe('browserName extraction', () => {
        const inner = 'wc:test@1?bridge=test&key=test'

        it('extracts the browser param from the wrapper', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' +
                encodeURIComponent(inner) +
                '&browser=chrome'

            const result = parseWalletConnectUri(wrapped)

            expect(result?.uri).toBe(inner)
            expect(result?.browserName).toBe('chrome')
        })

        it('decodes a percent-encoded browser value', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' +
                encodeURIComponent(inner) +
                '&browser=Mobile%20Safari'

            expect(parseWalletConnectUri(wrapped)?.browserName).toBe(
                'Mobile Safari',
            )
        })

        it('leaves browserName undefined when the wrapper has no browser param', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' + encodeURIComponent(inner)

            expect(parseWalletConnectUri(wrapped)?.browserName).toBeUndefined()
        })

        it('extracts the browser param from a raw (non-wrapper) WC URI', () => {
            // @perawallet/connect's Android branch appends `&browser=` to the
            // raw wc: URI; the wrapper form is iOS-only.
            const result = parseWalletConnectUri(
                'wc:test@1?bridge=test&key=test&browser=chrome',
            )

            expect(result).not.toBeNull()
            expect(result?.browserName).toBe('chrome')
        })

        it('still parses when the browser param has malformed percent-encoding', () => {
            const wrapped =
                'perawallet-wc://wc?uri=' +
                encodeURIComponent(inner) +
                '&browser=%E0%A4%A'

            const result = parseWalletConnectUri(wrapped)

            expect(result?.uri).toBe(inner)
            expect(result?.browserName).toBeUndefined()
        })
    })
})
