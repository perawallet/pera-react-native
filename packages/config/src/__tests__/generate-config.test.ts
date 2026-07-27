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
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const SCRIPT = join(__dirname, '../../../../tools/generate-config.sh')

describe('tools/generate-config.sh', () => {
    let dir: string

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'gen-config-'))
    })
    afterEach(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    const run = (env: Record<string, string>): string => {
        const out = join(dir, 'generated-env.ts')
        const emptyEnvFile = join(dir, '.env.base')
        writeFileSync(emptyEnvFile, '')
        execFileSync('bash', [SCRIPT], {
            env: {
                ...process.env,
                OUTPUT_FILE: out,
                ENV_FILE: emptyEnvFile,
                ...env,
            },
        })
        return readFileSync(out, 'utf8')
    }

    test('emits testnet genesis hash from TESTNET_GENESIS_HASH', () => {
        const output = run({ TESTNET_GENESIS_HASH: 'LOCALNETHASH=' })
        expect(output).toContain('testnetGenesisHash: "LOCALNETHASH="')
    })

    test('overlay file overrides base .env values', () => {
        const overlay = join(dir, '.env.overlay')
        writeFileSync(overlay, 'TESTNET_ALGOD_URL=http://localhost:4001\n')
        const output = run({ PERA_ENV_OVERLAY: overlay })
        expect(output).toContain('testnetAlgodUrl: "http://localhost:4001"')
    })

    test('emits firebase config from FIREBASE_* env vars', () => {
        const output = run({
            FIREBASE_API_KEY: 'test-api-key',
            FIREBASE_PROJECT_ID: 'test-project',
        })
        expect(output).toContain('firebaseApiKey: "test-api-key"')
        expect(output).toContain('firebaseProjectId: "test-project"')
    })

    test('emits gaMeasurementApiSecret and sentryDsn', () => {
        const output = run({
            GA_MEASUREMENT_API_SECRET: 'test-ga-secret',
            SENTRY_DSN: 'https://key@o0.ingest.sentry.io/0',
        })
        expect(output).toContain('gaMeasurementApiSecret: "test-ga-secret"')
        expect(output).toContain(
            'sentryDsn: "https://key@o0.ingest.sentry.io/0"',
        )
    })

    test('ignores obsolete web-feature URL environment variables', () => {
        const output = run({
            DISCOVER_BASE_URL: 'https://discover.example.com/',
            STAKING_BASE_URL: 'https://staking.example.com/',
            ONRAMP_BASE_URL: 'https://onramp.example.com/',
        })

        expect(output).not.toContain('discoverBaseUrl')
        expect(output).not.toContain('stakingBaseUrl')
        expect(output).not.toContain('onrampBaseUrl')
    })
})
