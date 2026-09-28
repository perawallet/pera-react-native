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
} from '../web-config.mjs'

const SCRIPT = join(__dirname, '../../../../tools/generate-config.sh')

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
            expect(generated).toContain('backendAPIKey: "value"')
            expect(generated).not.toContain('googleIosClientId')
        })
    })
})
