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

import { getConfig, overrideEnvironmentMap, type Config } from '../main'

const SCRIPT = join(__dirname, '../../../../tools/generate-config.sh')

/**
 * Env var names the script's production guard refuses to leave unset, read out
 * of its own source. Parsed rather than duplicated so the drift test below
 * can't pass by asserting against a stale copy of the list.
 */
const guardedEnvVars = (): string[] => {
    const source = readFileSync(SCRIPT, 'utf8')
    const loop = /for\s+var\s+in\s+([A-Z0-9_ ]+);\s*do/.exec(source)
    return loop ? loop[1].trim().split(/\s+/) : []
}

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

    // The guard is the only thing that catches a production build whose backend
    // URLs still resolve to the committed staging defaults, and it catches it
    // BEFORE the artifact is signed (main.ts's schema check only throws once the
    // config module is imported). It went six months without one of these.
    describe('production staging guard', () => {
        const runExpectingFailure = (env: Record<string, string>): string => {
            const emptyEnvFile = join(dir, '.env.base')
            writeFileSync(emptyEnvFile, '')
            try {
                execFileSync('bash', [SCRIPT], {
                    env: {
                        ...process.env,
                        OUTPUT_FILE: join(dir, 'generated-env.ts'),
                        ENV_FILE: emptyEnvFile,
                        MAINNET_BACKEND_URL: '',
                        TESTNET_BACKEND_URL: '',
                        ...env,
                    },
                    stdio: ['ignore', 'pipe', 'pipe'],
                })
            } catch (error) {
                const failure = error as { status?: number; stderr?: Buffer }
                expect(failure.status).not.toBe(0)
                return failure.stderr?.toString() ?? ''
            }
            throw new Error('expected generate-config.sh to exit non-zero')
        }

        test('fails a production build when a backend URL is unset', () => {
            expect(runExpectingFailure({ APP_ENV: 'production' })).toMatch(
                /MAINNET_BACKEND_URL is unset in a production build/,
            )
        })

        test('fails a production build when a backend URL points at staging', () => {
            expect(
                runExpectingFailure({
                    APP_ENV: 'production',
                    MAINNET_BACKEND_URL:
                        'https://mainnet.staging.api.perawallet.app',
                    TESTNET_BACKEND_URL: 'https://testnet.api.perawallet.app',
                }),
            ).toMatch(/MAINNET_BACKEND_URL points at staging/)
        })

        test('leaves non-production builds alone with no backend URLs set', () => {
            expect(() => run({ APP_ENV: 'staging' })).not.toThrow()
        })

        // main.ts derives its guard from the config VALUES, so a new staging
        // default is covered there automatically. This script hard-codes the
        // names, so the two can drift — and only this one runs before signing.
        test('guards every first-party staging default that has an env override', () => {
            const guarded = guardedEnvVars()
            expect(guarded.length).toBeGreaterThan(0)

            const defaults = getConfig({})
            const shouldBeGuarded = Object.entries(defaults)
                .filter(
                    ([, value]) =>
                        typeof value === 'string' &&
                        value.includes('staging') &&
                        value.includes('perawallet.app'),
                )
                .map(([field]) => overrideEnvironmentMap[field as keyof Config])
                .filter((name): name is string => Boolean(name))

            expect(shouldBeGuarded.length).toBeGreaterThan(0)
            expect(guarded).toEqual(expect.arrayContaining(shouldBeGuarded))
        })
    })
})
