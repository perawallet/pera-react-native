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

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
    WEB_CONFIG_ALLOWLIST,
    assertWebConfigAllowlisted,
    bakedIntegrityFlags,
} from '../web-config.mjs'

const SCRIPT = join(__dirname, '../../../../tools/dev/generate-config.sh')

const emittable = (): Map<string, string> => {
    const source = readFileSync(SCRIPT, 'utf8')
    return new Map(
        [
            ...source.matchAll(
                /^append_config "([A-Z0-9_]+)" "([A-Za-z0-9]+)" "(\w+)"/gm,
            ),
        ].map(([, envVar, key, type]) => [
            key,
            `${envVar}=${type === 'boolean' ? 'true' : type === 'number' ? '1' : 'value'}`,
        ]),
    )
}

describe('WEB_CONFIG_ALLOWLIST', () => {
    it('only names keys generate-config.sh can emit', () => {
        const keys = emittable()

        const unknown = WEB_CONFIG_ALLOWLIST.filter(key => !keys.has(key))

        expect(unknown).toEqual([])
    })

    it('leaves out the native-only keys', () => {
        for (const key of [
            'appStoreAppID',
            'playIntegrityCloudProjectNumber',
            'googleIosClientId',
            'googleWebClientId',
            'disableScreenCapturePrevention',
        ]) {
            expect(WEB_CONFIG_ALLOWLIST).not.toContain(key)
        }
    })
})

describe('the backend API key', () => {
    it('is never baked: the extension authenticates with its integrity token', () => {
        expect(WEB_CONFIG_ALLOWLIST).not.toContain('backendAPIKey')
    })
})

describe('bakedIntegrityFlags', () => {
    it('reads each flag the generated env sets to true', () => {
        const source =
            'export const generatedEnv = {\n  webIntegrityMintEnabled: true,\n  webIntegrityBearerEnabled: false,\n  webIntegrityEnrolEnabled: true,\n} as const;\n'

        expect(bakedIntegrityFlags(source)).toEqual({
            WEB_INTEGRITY_MINT_ENABLED: true,
            WEB_INTEGRITY_BEARER_ENABLED: false,
            WEB_INTEGRITY_ENROL_ENABLED: true,
        })
    })

    it('reads a flag generate-config.sh left out as off', () => {
        expect(
            bakedIntegrityFlags('export const generatedEnv = {\n} as const;\n'),
        ).toEqual({
            WEB_INTEGRITY_MINT_ENABLED: false,
            WEB_INTEGRITY_BEARER_ENABLED: false,
            WEB_INTEGRITY_ENROL_ENABLED: false,
        })
    })
})

describe('assertWebConfigAllowlisted', () => {
    it('accepts allowlisted keys', () => {
        const source =
            'export const generatedEnv = {\n  sentryDsn: "dsn",\n  debugEnabled: false,\n} as const;\n'

        expect(() => assertWebConfigAllowlisted(source)).not.toThrow()
    })

    it('names every key outside the allowlist', () => {
        const source =
            'export const generatedEnv = {\n  sentryDsn: "dsn",\n  googleIosClientId: "a",\n  mainnetCardEscrowAuthToken: "b",\n} as const;\n'

        expect(() => assertWebConfigAllowlisted(source)).toThrow(
            /googleIosClientId, mainnetCardEscrowAuthToken/,
        )
    })

    describe('against generate-config.sh', () => {
        let dir: string

        beforeEach(() => {
            dir = mkdtempSync(join(tmpdir(), 'web-config-'))
        })
        afterEach(() => {
            rmSync(dir, { recursive: true, force: true })
        })

        it('passes when every variable is set and the web allowlist is applied', () => {
            const envFile = join(dir, '.env')
            const out = join(dir, 'generated-env.ts')
            writeFileSync(envFile, [...emittable().values()].join('\n'))

            execFileSync('bash', [SCRIPT], {
                env: {
                    PATH: process.env.PATH,
                    ENV_FILE: envFile,
                    OUTPUT_FILE: out,
                    CONFIG_ALLOWLIST: WEB_CONFIG_ALLOWLIST.join(' '),
                },
                stdio: 'ignore',
            })
            const generated = readFileSync(out, 'utf8')

            expect(() => assertWebConfigAllowlisted(generated)).not.toThrow()
            expect(generated).toContain('sentryDsn: "value"')
            expect(generated).not.toContain('googleIosClientId')
            expect(generated).not.toContain('backendAPIKey')
        })

        it('bakes the Ethereum endpoints when CHAINS ships ethereum under the web allowlist', () => {
            const out = join(dir, 'generated-env.ts')

            execFileSync('bash', [SCRIPT], {
                env: {
                    PATH: process.env.PATH,
                    ENV_FILE: join(dir, 'missing.env'),
                    OUTPUT_FILE: out,
                    CONFIG_ALLOWLIST: WEB_CONFIG_ALLOWLIST.join(' '),
                    CHAINS: 'algorand,ethereum',
                    ETHEREUM_MAINNET_RPC_URL: 'https://mainnet.rpc.example',
                    ETHEREUM_SEPOLIA_RPC_URL: 'https://sepolia.rpc.example',
                    ETHEREUM_SEPOLIA_PERA_SERVICES: 'prices',
                },
                stdio: 'ignore',
            })
            const generated = readFileSync(out, 'utf8')

            expect(generated).toContain('chainIds: "algorand,ethereum"')
            expect(generated).toContain(
                'ethereumMainnetRpcUrl: "https://mainnet.rpc.example"',
            )
            expect(generated).toContain(
                'ethereumSepoliaRpcUrl: "https://sepolia.rpc.example"',
            )
            expect(generated).toContain('ethereumSepoliaPeraServices: "prices"')
        })
    })
})
