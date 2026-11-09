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
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    writeFileSync,
    rmSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
    EVM_CHAIN_NETWORKS,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'

import {
    scopeConfigKeys,
    getConfig,
    overrideEnvironmentMap,
    type Config,
} from '../main'

const SCRIPT = join(__dirname, '../../../../tools/dev/generate-config.sh')

type ChainNetworkRow = { id: string; tier: string } & Record<string, unknown>

type ChainPackage = {
    package: string
    networks: Record<string, ChainNetworkRow[]>
    mobileStubbedModules: string[]
    scopeConfigFields: { name: string; isRequired: boolean }[]
}

type ChainScopeConfigKey = {
    package: string
    chainId: string
    network: ChainNetworkRow
    field: string
    env: string
    key: string
    isRequired: boolean
}

const chainPackages = createRequire(import.meta.url)(
    '../../../../tools/dev/chain-packages.cjs',
) as {
    CHAIN_PACKAGES: ChainPackage[]
    EVM_CHAIN_PACKAGE: string
    chainPackageCapabilityConfigKeys: () => { env: string; key: string }[]
    chainPackageFieldConfigKeys: (
        packageName: string,
        fieldName: string,
    ) => ChainScopeConfigKey[]
    chainPackageNamed: (name: string) => ChainPackage
    chainPackageScopeConfigKeys: () => ChainScopeConfigKey[]
    validateChainPackages: (packages: ChainPackage[]) => void
}

const TEST_CHAIN_PACKAGES = join(
    __dirname,
    '../../../../tools/dev/__tests__/fixtures/test-chain-packages.cjs',
)

const EVM_CHAIN_IDS = Object.keys(EVM_CHAIN_NETWORKS) as EvmChainId[]

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

const TURBO_JSON = join(__dirname, '../../../../turbo.json')

// The literal lines, plus the chain package lines the script generates from the table.
const appendedEnvVars = (): string[] => [
    ...[
        ...readFileSync(SCRIPT, 'utf8').matchAll(
            /^append_config "([A-Z0-9_]+)"/gm,
        ),
    ].map(match => match[1]),
    ...chainPackages.chainPackageCapabilityConfigKeys().map(keys => keys.env),
    ...chainPackages.chainPackageScopeConfigKeys().map(keys => keys.env),
]

const isHashedByTurbo = (name: string, globalEnv: string[]): boolean =>
    globalEnv.some(entry =>
        entry.endsWith('*')
            ? name.startsWith(entry.slice(0, -1))
            : entry === name,
    )

describe('tools/dev/generate-config.sh', () => {
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

    test('emits reownProjectId from REOWN_PROJECT_ID', () => {
        const output = run({ REOWN_PROJECT_ID: 'test-project-id' })
        expect(output).toContain('reownProjectId: "test-project-id"')
    })

    test('emits cardAutoDrawTemplateHash from CARD_AUTODRAW_TEMPLATE_HASH', () => {
        const output = run({ CARD_AUTODRAW_TEMPLATE_HASH: 'abc123' })
        expect(output).toContain('cardAutoDrawTemplateHash: "abc123"')
    })

    test('emits the chain list and per-chain capability lists', () => {
        const output = run({
            CHAINS: 'algorand',
            CHAIN_ALGORAND_CAPABILITIES: 'send,receive',
            CHAIN_ETHEREUM_CAPABILITIES: 'send',
        })
        expect(output).toContain('chainIds: "algorand"')
        expect(output).toContain('chainAlgorandCapabilities: "send,receive"')
        expect(output).toContain('chainEthereumCapabilities: "send"')
    })

    test('names every table scope key and env var as the config schema does', () => {
        const tableKeys = chainPackages.chainPackageScopeConfigKeys()

        expect(tableKeys.length).toBeGreaterThan(0)
        for (const keys of tableKeys) {
            expect(overrideEnvironmentMap[keys.key as keyof Config]).toBe(
                keys.env,
            )
        }
    })

    test('names every EVM scope key as scopeConfigKeys does', () => {
        const expected = EVM_CHAIN_IDS.flatMap(chainId =>
            EVM_CHAIN_NETWORKS[chainId].networks.flatMap(network => {
                const keys = scopeConfigKeys(chainId, network.id)
                return [
                    {
                        chainId,
                        field: 'rpcUrl',
                        env: keys.rpcUrlEnv,
                        key: keys.rpcUrl,
                    },
                    {
                        chainId,
                        field: 'peraServices',
                        env: keys.peraServicesEnv,
                        key: keys.peraServices,
                    },
                ]
            }),
        )

        expect(
            chainPackages
                .chainPackageScopeConfigKeys()
                .map(({ chainId, field, env, key }) => ({
                    chainId,
                    field,
                    env,
                    key,
                })),
        ).toEqual(expected)
    })

    describe('validateChainPackages', () => {
        const testChainPackage = (
            name: string,
            chainId: string,
        ): ChainPackage => ({
            package: name,
            networks: { [chainId]: [{ id: 'mainnet', tier: 'mainnet' }] },
            mobileStubbedModules: [],
            scopeConfigFields: [{ name: 'rpcUrl', isRequired: true }],
        })

        test('accepts the committed table', () => {
            expect(() =>
                chainPackages.validateChainPackages(
                    chainPackages.CHAIN_PACKAGES,
                ),
            ).not.toThrow()
        })

        test('refuses a chain id that is not one word', () => {
            expect(() =>
                chainPackages.validateChainPackages([
                    testChainPackage('@perawallet/a', 'foo-bar'),
                ]),
            ).toThrow(/serves chain "foo-bar"/)
        })

        test('refuses a chain two packages serve', () => {
            expect(() =>
                chainPackages.validateChainPackages([
                    testChainPackage('@perawallet/a', 'base'),
                    testChainPackage('@perawallet/b', 'base'),
                ]),
            ).toThrow(
                /"base" is served by both @perawallet\/a and @perawallet\/b/,
            )
        })
    })

    describe('chainPackageNamed', () => {
        test('finds chain-ethereum', () => {
            expect(
                chainPackages.chainPackageNamed(chainPackages.EVM_CHAIN_PACKAGE)
                    .package,
            ).toBe('@perawallet/wallet-core-chain-ethereum')
        })

        test('refuses a name the table lacks', () => {
            expect(() =>
                chainPackages.chainPackageNamed('@perawallet/renamed'),
            ).toThrow(/No chain package named @perawallet\/renamed/)
        })
    })

    describe('chainPackageFieldConfigKeys', () => {
        test('lists one key per chain-ethereum network for the field', () => {
            const keys = chainPackages.chainPackageFieldConfigKeys(
                chainPackages.EVM_CHAIN_PACKAGE,
                'rpcUrl',
            )

            expect(keys.map(keys => keys.env)).toContain(
                'ETHEREUM_MAINNET_RPC_URL',
            )
            expect(keys.every(keys => keys.field === 'rpcUrl')).toBe(true)
            expect(keys).toHaveLength(
                Object.values(EVM_CHAIN_NETWORKS).flatMap(
                    ({ networks }) => networks,
                ).length,
            )
        })

        test('refuses a field the package does not declare', () => {
            expect(() =>
                chainPackages.chainPackageFieldConfigKeys(
                    chainPackages.EVM_CHAIN_PACKAGE,
                    'rpcUrls',
                ),
            ).toThrow(/bakes no rpcUrls config key/)
        })
    })

    describe('a test-only chain package in the table', () => {
        const TESTCHAIN_ENDPOINTS = {
            CHAIN_PACKAGES_TABLE: TEST_CHAIN_PACKAGES,
            TESTCHAIN_MAINNET_RPC_URL: 'https://testchain.rpc.example',
            TESTCHAIN_DEVNET_RPC_URL: 'https://testchain-devnet.rpc.example',
        }

        test('emits its RPC URLs and leaves an unset optional field out', () => {
            const output = run({
                CHAINS: 'algorand,testchain',
                ...TESTCHAIN_ENDPOINTS,
                TESTCHAIN_MAINNET_PERA_SERVICES: '',
            })

            expect(output).toContain(
                'testchainMainnetRpcUrl: "https://testchain.rpc.example"',
            )
            expect(output).toContain(
                'testchainDevnetRpcUrl: "https://testchain-devnet.rpc.example"',
            )
            expect(output).not.toContain('testchainMainnetPeraServices')
        })

        test.each(['algorand,testchain', 'algorand,\ttestchain'])(
            'fails a build with CHAINS=%j and TESTCHAIN_DEVNET_RPC_URL unset',
            chains => {
                expect(
                    runExpectingFailure({
                        CHAINS: chains,
                        ...TESTCHAIN_ENDPOINTS,
                        TESTCHAIN_DEVNET_RPC_URL: '',
                    }),
                ).toMatch(
                    /TESTCHAIN_DEVNET_RPC_URL is unset but CHAINS ships testchain/,
                )
            },
        )

        test('does not ask a build without it for its RPC URLs', () => {
            expect(() =>
                run({
                    CHAINS: 'algorand',
                    CHAIN_PACKAGES_TABLE: TEST_CHAIN_PACKAGES,
                    TESTCHAIN_MAINNET_RPC_URL: '',
                    TESTCHAIN_DEVNET_RPC_URL: '',
                }),
            ).not.toThrow()
        })

        test('fails when the allowlist bakes CHAINS but drops an RPC URL', () => {
            expect(
                runExpectingFailure({
                    CHAINS: 'algorand,testchain',
                    ...TESTCHAIN_ENDPOINTS,
                    CONFIG_ALLOWLIST: 'chainIds testchainMainnetRpcUrl',
                }),
            ).toMatch(/CONFIG_ALLOWLIST drops testchainDevnetRpcUrl/)
        })

        test('fails a build whose table names a chain id that is not one word', () => {
            const table = join(dir, 'hyphenated-chain-packages.cjs')
            writeFileSync(
                table,
                `module.exports = { CHAIN_PACKAGES: ${JSON.stringify([
                    {
                        package: '@perawallet/wallet-core-chain-testchain',
                        networks: {
                            'test-chain': [{ id: 'mainnet', tier: 'mainnet' }],
                        },
                        mobileStubbedModules: [],
                        scopeConfigFields: [
                            { name: 'rpcUrl', isRequired: true },
                        ],
                    },
                ])} }`,
            )

            expect(
                runExpectingFailure({ CHAIN_PACKAGES_TABLE: table }),
            ).toMatch(/serves chain "test-chain"/)
            expect(existsSync(join(dir, 'generated-env.ts'))).toBe(false)
        })

        test('fails before writing anything when the table is missing', () => {
            expect(
                runExpectingFailure({
                    CHAIN_PACKAGES_TABLE: join(dir, 'missing.cjs'),
                }),
            ).toMatch(/Cannot find module/)
            expect(existsSync(join(dir, 'generated-env.ts'))).toBe(false)
        })
    })

    test('emits the capability list of a chain added to the EVM table', () => {
        const output = run({ CHAIN_BASE_CAPABILITIES: 'send' })

        expect(output).toContain('chainBaseCapabilities: "send"')
    })

    describe('a chain added to the EVM table', () => {
        const BASE_ENDPOINTS = {
            BASE_MAINNET_RPC_URL: 'https://base.rpc.example',
            BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.rpc.example',
        }

        test('emits its RPC URLs and Pera service lists', () => {
            const output = run({
                CHAINS: 'algorand,base',
                ...BASE_ENDPOINTS,
                BASE_MAINNET_PERA_SERVICES: 'assets,history',
            })

            expect(output).toContain(
                'baseMainnetRpcUrl: "https://base.rpc.example"',
            )
            expect(output).toContain(
                'baseSepoliaRpcUrl: "https://base-sepolia.rpc.example"',
            )
            expect(output).toContain(
                'baseMainnetPeraServices: "assets,history"',
            )
        })

        test.each(['BASE_MAINNET_RPC_URL', 'BASE_SEPOLIA_RPC_URL'])(
            'fails a build that ships it with %s unset',
            variable => {
                expect(
                    runExpectingFailure({
                        CHAINS: 'algorand,base',
                        ...BASE_ENDPOINTS,
                        [variable]: '',
                    }),
                ).toMatch(
                    new RegExp(`${variable} is unset but CHAINS ships base`),
                )
            },
        )

        test('does not ask a build without it for its RPC URLs', () => {
            expect(() =>
                run({
                    CHAINS: 'algorand,ethereum',
                    ETHEREUM_MAINNET_RPC_URL: 'https://mainnet.rpc.example',
                    ETHEREUM_SEPOLIA_RPC_URL: 'https://sepolia.rpc.example',
                    BASE_MAINNET_RPC_URL: '',
                    BASE_SEPOLIA_RPC_URL: '',
                }),
            ).not.toThrow()
        })
    })

    describe('ethereum endpoints', () => {
        const ETHEREUM_ENDPOINTS = {
            ETHEREUM_MAINNET_RPC_URL: 'https://mainnet.rpc.example',
            ETHEREUM_SEPOLIA_RPC_URL: 'https://sepolia.rpc.example',
        }

        test('emits the RPC URLs and Pera service lists', () => {
            const output = run({
                CHAINS: 'algorand,ethereum',
                ...ETHEREUM_ENDPOINTS,
                ETHEREUM_MAINNET_PERA_SERVICES: 'prices,history',
                ETHEREUM_SEPOLIA_PERA_SERVICES: 'assets',
            })

            expect(output).toContain(
                'ethereumMainnetRpcUrl: "https://mainnet.rpc.example"',
            )
            expect(output).toContain(
                'ethereumSepoliaRpcUrl: "https://sepolia.rpc.example"',
            )
            expect(output).toContain(
                'ethereumMainnetPeraServices: "prices,history"',
            )
            expect(output).toContain('ethereumSepoliaPeraServices: "assets"')
        })

        test('bakes a comma list of RPC URLs verbatim, in order', () => {
            const output = run({
                CHAINS: 'algorand,ethereum',
                ...ETHEREUM_ENDPOINTS,
                ETHEREUM_MAINNET_RPC_URL:
                    'https://a.rpc.example,https://b.rpc.example',
            })

            expect(output).toContain(
                'ethereumMainnetRpcUrl: "https://a.rpc.example,https://b.rpc.example"',
            )
        })

        test.each(['ETHEREUM_MAINNET_RPC_URL', 'ETHEREUM_SEPOLIA_RPC_URL'])(
            'fails a build that ships ethereum with %s unset',
            variable => {
                expect(
                    runExpectingFailure({
                        CHAINS: 'algorand, ethereum',
                        ...ETHEREUM_ENDPOINTS,
                        [variable]: '',
                    }),
                ).toMatch(
                    new RegExp(
                        `${variable} is unset but CHAINS ships ethereum`,
                    ),
                )
            },
        )

        test('treats any whitespace in CHAINS as a separator', () => {
            expect(
                runExpectingFailure({
                    CHAINS: 'algorand,\tethereum',
                    ETHEREUM_MAINNET_RPC_URL: '',
                    ETHEREUM_SEPOLIA_RPC_URL: '',
                }),
            ).toMatch(/ETHEREUM_MAINNET_RPC_URL is unset/)
        })

        // The browser build passes an allowlist; one that bakes the chain list
        // but not the RPC URLs would ship Ethereum without them.
        test('fails when the allowlist bakes CHAINS but drops an RPC URL', () => {
            expect(
                runExpectingFailure({
                    CHAINS: 'algorand,ethereum',
                    ...ETHEREUM_ENDPOINTS,
                    CONFIG_ALLOWLIST: 'chainIds ethereumMainnetRpcUrl',
                }),
            ).toMatch(/CONFIG_ALLOWLIST drops ethereumSepoliaRpcUrl/)
        })

        test('passes when the allowlist bakes CHAINS and both RPC URLs', () => {
            const output = run({
                CHAINS: 'algorand,ethereum',
                ...ETHEREUM_ENDPOINTS,
                CONFIG_ALLOWLIST:
                    'chainIds ethereumMainnetRpcUrl ethereumSepoliaRpcUrl',
            })

            expect(output).toContain('ethereumSepoliaRpcUrl:')
        })

        test('passes when the allowlist does not bake CHAINS at all', () => {
            expect(() =>
                run({
                    CHAINS: 'algorand,ethereum',
                    ...ETHEREUM_ENDPOINTS,
                    CONFIG_ALLOWLIST: 'reownProjectId',
                }),
            ).not.toThrow()
        })

        test.each(['', 'algorand'])(
            'leaves a build with CHAINS=%j and no RPC URLs alone',
            chains => {
                expect(() =>
                    run({
                        CHAINS: chains,
                        ETHEREUM_MAINNET_RPC_URL: '',
                        ETHEREUM_SEPOLIA_RPC_URL: '',
                    }),
                ).not.toThrow()
            },
        )
    })

    // turbo hashes only globalEnv into the build key, so a variable missing
    // there lets a cached dist ship a stale generated-env.ts.
    test('hashes every variable the script bakes into the turbo cache key', () => {
        const { globalEnv } = JSON.parse(readFileSync(TURBO_JSON, 'utf8')) as {
            globalEnv: string[]
        }
        const baked = appendedEnvVars()

        expect(baked.length).toBeGreaterThan(0)
        expect(baked.filter(name => !isHashedByTurbo(name, globalEnv))).toEqual(
            [],
        )
    })

    test('omits reownProjectId when REOWN_PROJECT_ID is unset', () => {
        const output = run({ REOWN_PROJECT_ID: '' })
        expect(output).not.toContain('reownProjectId')
    })

    test('emits only allowlisted keys when CONFIG_ALLOWLIST is set', () => {
        const output = run({
            CONFIG_ALLOWLIST: 'sentryDsn mainnetBidaliBaseUrl',
            SENTRY_DSN: 'https://key@o0.ingest.sentry.io/0',
            MAINNET_BIDALI_BASE_URL: 'https://bidali.example.com',
            MAINNET_BIDALI_API_KEY: 'bidali-key',
            GOOGLE_IOS_CLIENT_ID: 'ios-client',
        })

        expect(output).toContain(
            'sentryDsn: "https://key@o0.ingest.sentry.io/0"',
        )
        expect(output).toContain(
            'mainnetBidaliBaseUrl: "https://bidali.example.com"',
        )
        expect(output).not.toContain('mainnetBidaliApiKey')
        expect(output).not.toContain('googleIosClientId')
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

        // Same argument as the backend URLs: the relay rejects a client with no
        // project id, so v2 pairing is dead in a build that is already signed.
        test('fails a production build when REOWN_PROJECT_ID is unset', () => {
            expect(
                runExpectingFailure({
                    APP_ENV: 'production',
                    MAINNET_BACKEND_URL: 'https://mainnet.api.perawallet.app',
                    TESTNET_BACKEND_URL: 'https://testnet.api.perawallet.app',
                    BACKUP_BASE_URL: 'https://backup.perawallet.app/',
                    REOWN_PROJECT_ID: '',
                }),
            ).toMatch(/REOWN_PROJECT_ID is unset in a production build/)
        })

        test('fails a production build that swaps the chain package table', () => {
            expect(
                runExpectingFailure({
                    APP_ENV: 'production',
                    MAINNET_BACKEND_URL: 'https://mainnet.api.perawallet.app',
                    TESTNET_BACKEND_URL: 'https://testnet.api.perawallet.app',
                    BACKUP_BASE_URL: 'https://backup.perawallet.app/',
                    REOWN_PROJECT_ID: 'project-id',
                    CHAIN_PACKAGES_TABLE: TEST_CHAIN_PACKAGES,
                }),
            ).toMatch(/CHAIN_PACKAGES_TABLE is refused in a production build/)
        })

        test('leaves a non-production build with no project id alone', () => {
            expect(() =>
                run({ APP_ENV: 'staging', REOWN_PROJECT_ID: '' }),
            ).not.toThrow()
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
