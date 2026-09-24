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

import { assertExtensionPagesCsp, buildExtensionPagesCsp } from '../csp.mjs'

const frameOrigins = [
    'https://discover-mobile.perawallet.app',
    'https://integrity.perawallet.app',
    'https://commerce.bidali.com',
    'https://giftcards.bidali.com',
]

const directive = (csp: string, name: string): string[] =>
    csp
        .split('; ')
        .find(entry => entry.startsWith(`${name} `))
        ?.split(' ')
        .slice(1) ?? []

describe('buildExtensionPagesCsp', () => {
    it('states a default, closes plugins and keeps scripts local', () => {
        const csp = buildExtensionPagesCsp({
            appEnvironment: 'production',
            frameOrigins,
        })

        expect(directive(csp, 'default-src')).toEqual(["'self'"])
        expect(directive(csp, 'object-src')).toEqual(["'none'"])
        expect(directive(csp, 'script-src')).toEqual([
            "'self'",
            "'wasm-unsafe-eval'",
        ])
    })

    it('frames exactly the given origins, once each', () => {
        const csp = buildExtensionPagesCsp({
            appEnvironment: 'production',
            frameOrigins: [...frameOrigins, frameOrigins[0]],
        })

        expect(directive(csp, 'frame-src')).toEqual(frameOrigins)
    })

    it('allows loopback only outside production', () => {
        const production = buildExtensionPagesCsp({
            appEnvironment: 'production',
            frameOrigins,
        })
        const development = buildExtensionPagesCsp({
            appEnvironment: 'development',
            frameOrigins,
        })

        expect(directive(production, 'connect-src')).toEqual([
            "'self'",
            'https:',
            'wss:',
            'data:',
            'blob:',
        ])
        expect(directive(development, 'connect-src')).toContain(
            'ws://127.0.0.1:*',
        )
    })
})

describe('assertExtensionPagesCsp', () => {
    it('accepts the generated policy', () => {
        const csp = buildExtensionPagesCsp({
            appEnvironment: 'production',
            frameOrigins,
        })

        expect(() =>
            assertExtensionPagesCsp(csp, {
                appEnvironment: 'production',
                requiredFrameOrigins: frameOrigins,
            }),
        ).not.toThrow()
    })

    it('rejects a policy that lost its default or reopened plugins', () => {
        const csp =
            "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; frame-src https://discover-mobile.perawallet.app"

        expect(() =>
            assertExtensionPagesCsp(csp, {
                appEnvironment: 'production',
                requiredFrameOrigins: [],
            }),
        ).toThrow(/default-src.*\n.*object-src/)
    })

    it('rejects a missing frame origin and a non-https frame source', () => {
        const csp = buildExtensionPagesCsp({
            appEnvironment: 'development',
            frameOrigins: ['http://discover.example'],
        })

        expect(() =>
            assertExtensionPagesCsp(csp, {
                appEnvironment: 'development',
                requiredFrameOrigins: ['https://integrity.perawallet.app'],
            }),
        ).toThrow(/missing https:\/\/integrity.*\n.*non-https/)
    })

    it('rejects loopback in a production policy', () => {
        const csp = buildExtensionPagesCsp({
            appEnvironment: 'development',
            frameOrigins,
        })

        expect(() =>
            assertExtensionPagesCsp(csp, {
                appEnvironment: 'production',
                requiredFrameOrigins: frameOrigins,
            }),
        ).toThrow(/loopback/)
    })
})
