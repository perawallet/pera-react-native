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
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
    WEB_CONFIG_ALLOWLIST,
    assertE2eEvmRpcOverrideAllowed,
    assertWebConfigAllowlisted,
    bakedAppEnvironment,
    bakedIntegrityFlags,
    overrideEvmRpcUrls,
} from '../web-config.mjs'

const SCRIPT = join(__dirname, '../../../../tools/dev/generate-config.sh')

const evmTooling = createRequire(import.meta.url)(
    '../../../../tools/dev/evm-config-keys.cjs',
) as {
    evmChainConfigKeys: () => {
        capabilitiesEnv: string
        capabilitiesKey: string
    }[]
    evmScopeConfigKeys: () => {
        rpcUrlEnv: string
        rpcUrlKey: string
        peraServicesEnv: string
        peraServicesKey: string
    }[]
}

// The literal lines, plus the EVM lines the script generates from the table.
const emittable = (): Map<string, string> => {
    const source = readFileSync(SCRIPT, 'utf8')
    return new Map([
        ...[
            ...source.matchAll(
                /^append_config "([A-Z0-9_]+)" "([A-Za-z0-9]+)" "(\w+)"/gm,
            ),
        ].map(([, envVar, key, type]): [string, string] => [
            key,
            `${envVar}=${type === 'boolean' ? 'true' : type === 'number' ? '1' : 'value'}`,
        ]),
        ...evmTooling
            .evmChainConfigKeys()
            .map((keys): [string, string] => [
                keys.capabilitiesKey,
                `${keys.capabilitiesEnv}=value`,
            ]),
        ...evmTooling
            .evmScopeConfigKeys()
            .flatMap((keys): [string, string][] => [
                [keys.rpcUrlKey, `${keys.rpcUrlEnv}=value`],
                [keys.peraServicesKey, `${keys.peraServicesEnv}=value`],
            ]),
    ])
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

describe('bakedAppEnvironment', () => {
    it('reads the channel the generated env sets', () => {
        expect(
            bakedAppEnvironment(
                'export const generatedEnv = {\n  appEnvironment: "staging",\n} as const;\n',
            ),
        ).toBe('staging')
    })

    it('reads a channel generate-config.sh left out as development', () => {
        expect(
            bakedAppEnvironment('export const generatedEnv = {\n} as const;\n'),
        ).toBe('development')
    })
})

describe('assertE2eEvmRpcOverrideAllowed', () => {
    it('accepts a development build', () => {
        expect(() =>
            assertE2eEvmRpcOverrideAllowed('development'),
        ).not.toThrow()
    })

    it.each(['staging', 'production'])('refuses a %s build', channel => {
        expect(() => assertE2eEvmRpcOverrideAllowed(channel)).toThrow(
            new RegExp(`${channel} build`),
        )
    })
})

describe('overrideEvmRpcUrls', () => {
    const URL = 'http://127.0.0.1:18545'

    it('points every baked RPC URL at the override and touches nothing else', () => {
        const source = [
            'export const generatedEnv = {',
            '  mainnetAlgodUrl: "https://mainnet-api.algonode.cloud",',
            '  chainIds: "algorand,ethereum,base",',
            '  ethereumMainnetRpcUrl: "https://ethereum-rpc.publicnode.com",',
            '  ethereumMainnetPeraServices: "prices,assets",',
            '  baseSepoliaRpcUrl: "https://base-sepolia-rpc.publicnode.com",',
            '} as const;',
            '',
        ].join('\n')

        expect(overrideEvmRpcUrls(source, URL)).toBe(
            source
                .replace('https://ethereum-rpc.publicnode.com', URL)
                .replace('https://base-sepolia-rpc.publicnode.com', URL),
        )
    })

    it('adds no chain: a network the build does not configure stays absent', () => {
        const source =
            'export const generatedEnv = {\n  baseMainnetRpcUrl: "https://base.rpc.example",\n} as const;\n'

        const overridden = overrideEvmRpcUrls(source, URL)

        expect(overridden).toContain(`baseMainnetRpcUrl: "${URL}"`)
        expect(overridden).not.toContain('bscMainnetRpcUrl')
    })

    it('rewrites a URL that carries an escaped quote whole', () => {
        const source =
            'export const generatedEnv = {\n  baseMainnetRpcUrl: "https://a.example/\\"x",\n} as const;\n'

        expect(overrideEvmRpcUrls(source, URL)).toBe(
            `export const generatedEnv = {\n  baseMainnetRpcUrl: "${URL}",\n} as const;\n`,
        )
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

        it('bakes a build that ships Base alone with its RPC URLs', () => {
            const out = join(dir, 'generated-env.ts')
            writeFileSync(join(dir, '.env'), '')

            execFileSync('bash', [SCRIPT], {
                env: {
                    PATH: process.env.PATH,
                    ENV_FILE: join(dir, '.env'),
                    OUTPUT_FILE: out,
                    CONFIG_ALLOWLIST: WEB_CONFIG_ALLOWLIST.join(' '),
                    CHAINS: 'algorand,base',
                    BASE_MAINNET_RPC_URL: 'https://base.rpc.example',
                    BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.rpc.example',
                },
                stdio: 'ignore',
            })
            const generated = readFileSync(out, 'utf8')

            expect(() => assertWebConfigAllowlisted(generated)).not.toThrow()
            expect(generated).toContain(
                'baseMainnetRpcUrl: "https://base.rpc.example"',
            )
        })

        it('bakes a build that ships Base alone with its RPC URLs', () => {
            const out = join(dir, 'generated-env.ts')
            writeFileSync(join(dir, '.env'), '')

            execFileSync('bash', [SCRIPT], {
                env: {
                    PATH: process.env.PATH,
                    ENV_FILE: join(dir, '.env'),
                    OUTPUT_FILE: out,
                    CONFIG_ALLOWLIST: WEB_CONFIG_ALLOWLIST.join(' '),
                    CHAINS: 'algorand,base',
                    BASE_MAINNET_RPC_URL: 'https://base.rpc.example',
                    BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.rpc.example',
                },
                stdio: 'ignore',
            })
            const generated = readFileSync(out, 'utf8')

            expect(() => assertWebConfigAllowlisted(generated)).not.toThrow()
            expect(generated).toContain(
                'baseMainnetRpcUrl: "https://base.rpc.example"',
            )
        })
    })
})
