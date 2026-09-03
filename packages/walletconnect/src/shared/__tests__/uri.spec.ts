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
import { redactWalletConnectUri, walletConnectLogContext } from '../uri'

describe('walletConnectLogContext', () => {
    it('extracts topic and bridge origin without exposing the key', () => {
        const out = walletConnectLogContext(
            'wc:abc-topic@1?bridge=https%3A%2F%2Fbridge.example%2Fsub&key=deadbeef',
        )
        expect(out).toEqual({
            topic: 'abc-topic',
            bridgeOrigin: 'https://bridge.example',
        })
        expect(JSON.stringify(out)).not.toContain('deadbeef')
    })

    it('handles an unencoded bridge value', () => {
        expect(
            walletConnectLogContext('wc:t@1?bridge=https://b.example&key=beef'),
        ).toEqual({ topic: 't', bridgeOrigin: 'https://b.example' })
    })

    it('returns nulls for a non-wc string', () => {
        expect(walletConnectLogContext('https://evil.com')).toEqual({
            topic: null,
            bridgeOrigin: null,
        })
    })

    it('returns a null bridgeOrigin for a malformed bridge value', () => {
        expect(walletConnectLogContext('wc:t@1?bridge=%ZZ&key=beef')).toEqual({
            topic: 't',
            bridgeOrigin: null,
        })
    })

    it('never surfaces the key of a v1 URI still wrapped in the deep-link scheme', () => {
        const key =
            '41791102999c339c844880b23950704cc43aa840f3739e365323cda4dfa89e7a'
        const wrapped = `perawallet-wc://wc?uri=${encodeURIComponent(
            `wc:topic@1?bridge=https%3A%2F%2Fb.example&key=${key}`,
        )}`

        expect(JSON.stringify(walletConnectLogContext(wrapped))).not.toContain(
            key,
        )
    })

    it('never surfaces the symKey of a v2-shaped URI', () => {
        const out = walletConnectLogContext(
            'wc:topic@2?relay-protocol=irn&symKey=cafef00d',
        )

        expect(out.topic).toBe('topic')
        expect(JSON.stringify(out)).not.toContain('cafef00d')
    })
})

describe('redactWalletConnectUri', () => {
    it('blanks the v1 key and keeps the rest of the URI readable', () => {
        expect(
            redactWalletConnectUri(
                'wc:t@1?bridge=https%3A%2F%2Fb.example&key=deadbeef',
            ),
        ).toBe('wc:t@1?bridge=https%3A%2F%2Fb.example&key=[redacted]')
    })

    it('blanks the v2 symKey', () => {
        expect(
            redactWalletConnectUri(
                'wc:t@2?relay-protocol=irn&symKey=cafef00d&expiryTimestamp=1',
            ),
        ).toBe('wc:t@2?relay-protocol=irn&symKey=[redacted]&expiryTimestamp=1')
    })

    it('blanks a key that is still percent-encoded inside a deep-link wrapper', () => {
        const redacted = redactWalletConnectUri(
            'perawallet-wc://wc?uri=wc%3At%401%3Fbridge%3Dhttps%253A%252F%252Fb.example%26key%3Ddeadbeef&browser=safari',
        )

        expect(redacted).not.toContain('deadbeef')
        expect(redacted).toContain('browser=safari')
    })
})
