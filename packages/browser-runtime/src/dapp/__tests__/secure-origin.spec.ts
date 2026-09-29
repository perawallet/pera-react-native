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
import { isSecureDappOrigin } from '../secure-origin'

describe('isSecureDappOrigin', () => {
    it.each([
        'https://example.com',
        'https://sub.example.co.uk',
        'https://example.com:8443',
    ])('accepts the https origin %s', origin => {
        expect(isSecureDappOrigin(origin)).toBe(true)
    })

    it.each([
        'http://localhost',
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://[::1]:5173',
    ])('accepts the loopback dev origin %s', origin => {
        expect(isSecureDappOrigin(origin)).toBe(true)
    })

    // The attack this gate exists for: credential lookup and RP-ID resolution
    // key on the bare registrable domain, so without the scheme check a
    // plaintext origin reaches the https credential of the same host.
    it('rejects plaintext http on a routable host', () => {
        expect(isSecureDappOrigin('http://example.com')).toBe(false)
    })

    it('rejects a host that merely embeds a loopback name', () => {
        expect(isSecureDappOrigin('http://localhost.evil.com')).toBe(false)
        expect(isSecureDappOrigin('http://127.0.0.1.evil.com')).toBe(false)
    })

    it.each([undefined, null, '', 'null'])(
        'rejects the opaque/absent origin %s',
        origin => {
            expect(isSecureDappOrigin(origin)).toBe(false)
        },
    )

    it.each(['not-a-url', 'file:///etc/passwd', 'chrome-extension://abc'])(
        'rejects the non-web origin %s',
        origin => {
            expect(isSecureDappOrigin(origin)).toBe(false)
        },
    )
})
