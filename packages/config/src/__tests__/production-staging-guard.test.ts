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
import { config, configSchema, type Config } from '../main'

// The committed defaults deliberately point the backend URLs at staging (safe
// for open-source builds); production builds are expected to override them
// via env. A missing override must fail the build loudly, not ship a
// production app that talks to staging. discoverBaseUrl needs no guard —
// getConfig derives it from appEnvironment structurally.

const prodOverrides = {
    mainnetBackendUrl: 'https://mainnet.api.perawallet.app',
    testnetBackendUrl: 'https://testnet.api.perawallet.app',
    // Spread from the ambient `config`, this carries whatever the local
    // generated-env resolved to — a staging host unless APP_ENV was production.
    // getConfig always derives it, so pin it to keep the fixture coherent.
    discoverBaseUrl: 'https://discover-mobile.perawallet.app/',
}

const baseProdConfig: Config = {
    ...config,
    ...prodOverrides,
    appEnvironment: 'production',
}

const STAGING_FIELDS = [
    ['mainnetBackendUrl', 'https://mainnet.staging.api.perawallet.app'],
    ['testnetBackendUrl', 'https://testnet.staging.api.perawallet.app'],
] as const

describe('production staging-URL guard', () => {
    it.each(STAGING_FIELDS)(
        'rejects a production config whose %s still points at staging',
        (field, stagingUrl) => {
            const candidate = { ...baseProdConfig, [field]: stagingUrl }

            expect(() => configSchema.parse(candidate)).toThrowError(
                new RegExp(field),
            )
        },
    )

    it('accepts a production config with production URLs', () => {
        expect(() => configSchema.parse(baseProdConfig)).not.toThrow()
    })

    it.each(['development', 'staging'] as const)(
        'leaves %s builds free to use staging URLs',
        environment => {
            // Pin the staging URLs explicitly: `config` reflects whatever
            // generate-config.sh baked from the local .env, which on a machine
            // with the production overrides set contains no staging host at all
            // — the assertion would then pass without exercising the guard.
            const candidate: Config = {
                ...config,
                mainnetBackendUrl: STAGING_FIELDS[0][1],
                testnetBackendUrl: STAGING_FIELDS[1][1],
                appEnvironment: environment,
            }

            expect(() => configSchema.parse(candidate)).not.toThrow()
        },
    )

    it('ignores discoverBaseUrl, which getConfig derives instead of reading from env', () => {
        const candidate: Config = {
            ...baseProdConfig,
            discoverBaseUrl: 'https://discover-mobile-staging.perawallet.app/',
        }

        expect(() => configSchema.parse(candidate)).not.toThrow()
    })

    it('ignores a third-party sandbox host in a production build', () => {
        const candidate: Config = {
            ...baseProdConfig,
            testnetBidaliBaseUrl: 'https://commerce.staging.bidali.com/dapp',
        }

        expect(() => configSchema.parse(candidate)).not.toThrow()
    })

    it('names the env var to set in the failure message', () => {
        const candidate = {
            ...baseProdConfig,
            mainnetBackendUrl: STAGING_FIELDS[0][1],
        }

        expect(() => configSchema.parse(candidate)).toThrowError(
            /MAINNET_BACKEND_URL/,
        )
    })
})
