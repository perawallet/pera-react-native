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

import { buildExtensionPagesCsp } from '../csp.mjs'

const productionInput = {
    appEnvironment: 'production',
    discoverBaseUrl: 'https://discover-mobile.perawallet.app/',
    integrityCheckOrigin: 'https://integrity.perawallet.app',
    bidaliBaseUrls: [
        'https://commerce.bidali.com/dapp',
        'https://commerce.staging.bidali.com/dapp',
        '',
    ],
    termsOfServiceUrl: 'https://perawallet.app/terms-and-services/',
}

const directive = (csp: string, name: string): string[] =>
    csp
        .split('; ')
        .find(entry => entry.startsWith(`${name} `))
        ?.split(' ')
        .slice(1) ?? []

describe('buildExtensionPagesCsp', () => {
    it('states a default and closes plugins', () => {
        const csp = buildExtensionPagesCsp(productionInput)

        expect(directive(csp, 'default-src')).toEqual(["'self'"])
        expect(directive(csp, 'object-src')).toEqual(["'none'"])
        expect(directive(csp, 'script-src')).toEqual([
            "'self'",
            "'wasm-unsafe-eval'",
        ])
    })

    it('frames only the configured origins, including the Bidali redirect twins', () => {
        const csp = buildExtensionPagesCsp(productionInput)

        expect(directive(csp, 'frame-src')).toEqual([
            'https://discover-mobile.perawallet.app',
            'https://integrity.perawallet.app',
            'https://perawallet.app',
            'https://commerce.bidali.com',
            'https://giftcards.bidali.com',
            'https://commerce.staging.bidali.com',
            'https://giftcards.staging.bidali.com',
        ])
    })

    it('keeps staging Discover and integrity out of a production policy', () => {
        const csp = buildExtensionPagesCsp(productionInput)

        expect(csp).not.toContain('discover-mobile-staging')
        expect(csp).not.toContain('integrity-staging')
    })

    it('allows loopback only outside production', () => {
        const production = buildExtensionPagesCsp(productionInput)
        const development = buildExtensionPagesCsp({
            ...productionInput,
            appEnvironment: 'development',
        })

        expect(directive(production, 'connect-src')).toEqual([
            "'self'",
            'https:',
            'wss:',
        ])
        expect(directive(development, 'connect-src')).toContain(
            'ws://127.0.0.1:*',
        )
    })
})
