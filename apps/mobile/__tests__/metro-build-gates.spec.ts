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

import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
    CHAIN_PACKAGES,
    EVM_CHAIN_PACKAGE,
    chainPackageNamed,
} from '../../../tools/dev/chain-packages.cjs'
import {
    DEVELOPER_GALLERY_MODULES,
    E2E_FIXTURE_MODULES,
    isChainPackageIncluded,
    isDeveloperGalleryIncluded,
    isBenchBuild,
    isE2eFixturesIncluded,
    readBakedAppEnvironment,
    readBakedChainIds,
    stubbedChainModules,
    toStubMap,
} from '../metro-build-gates'

const PROJECT_ROOT = path.resolve(__dirname, '..')

const writeGeneratedEnv = (body: string): string => {
    const file = path.join(
        mkdtempSync(path.join(tmpdir(), 'generated-env-')),
        'generated-env.ts',
    )
    writeFileSync(file, `export const generatedEnv = {\n${body}}\n`)
    return file
}

describe('readBakedAppEnvironment', () => {
    it('reads the channel generate-config.sh baked', () => {
        const file = writeGeneratedEnv(
            '  mainnetBackendUrl: "https://example.test",\n  appEnvironment: "production",\n',
        )

        expect(readBakedAppEnvironment(file)).toBe('production')
    })

    it('is undefined when APP_ENV was unset at generate time', () => {
        const file = writeGeneratedEnv('  releaseTag: "v1.0.0",\n')

        expect(readBakedAppEnvironment(file)).toBeUndefined()
    })

    it('is undefined when the file was never generated', () => {
        expect(
            readBakedAppEnvironment(path.join(tmpdir(), 'missing', 'env.ts')),
        ).toBeUndefined()
    })
})

describe('readBakedChainIds', () => {
    it('reads the comma list generate-config.sh baked, trimmed', () => {
        const file = writeGeneratedEnv('  chainIds: "algorand, ethereum",\n')

        expect(readBakedChainIds(file)).toEqual(['algorand', 'ethereum'])
    })

    it('is undefined when CHAINS was unset at generate time', () => {
        const file = writeGeneratedEnv('  releaseTag: "v1.0.0",\n')

        expect(readBakedChainIds(file)).toBeUndefined()
    })

    it('is undefined when the file was never generated', () => {
        expect(
            readBakedChainIds(path.join(tmpdir(), 'missing', 'env.ts')),
        ).toBeUndefined()
    })
})

describe('isDeveloperGalleryIncluded', () => {
    it.each([
        [undefined, undefined],
        ['development', undefined],
        ['staging', undefined],
        ['staging', 'staging'],
    ])('includes the gallery for baked=%s, APP_ENV=%s', (baked, appEnv) => {
        expect(
            isDeveloperGalleryIncluded({ bakedAppEnvironment: baked, appEnv }),
        ).toBe(true)
    })

    it.each([
        ['production', undefined],
        [undefined, 'production'],
        ['staging', 'production'],
        ['production', 'staging'],
    ])('excludes the gallery for baked=%s, APP_ENV=%s', (baked, appEnv) => {
        expect(
            isDeveloperGalleryIncluded({ bakedAppEnvironment: baked, appEnv }),
        ).toBe(false)
    })
})

// The same test-only package generate-config.spec refuses without its URLs.
const { CHAIN_PACKAGES: TEST_CHAIN_PACKAGES } = createRequire(import.meta.url)(
    '../../../tools/dev/__tests__/fixtures/test-chain-packages.cjs',
) as { CHAIN_PACKAGES: typeof CHAIN_PACKAGES }

const EVM_PACKAGE = chainPackageNamed(EVM_CHAIN_PACKAGE)

describe('stubbedChainModules', () => {
    it.each([[['algorand']], [[]]])(
        'stubs a chain package the chain list %j leaves out',
        chainIds => {
            expect(stubbedChainModules(chainIds, TEST_CHAIN_PACKAGES)).toEqual([
                'src/testchain/entry',
            ])
        },
    )

    it('keeps a chain package the chain list ships', () => {
        expect(
            stubbedChainModules(['algorand', 'testchain'], TEST_CHAIN_PACKAGES),
        ).toEqual([])
    })

    it('stubs the EVM entry modules of an Algorand-only build', () => {
        expect(stubbedChainModules(['algorand'])).toEqual([
            'src/bootstrap/evm-chain-modules',
            'src/modules/ethereum/chain-ui',
        ])
    })

    it('keeps the EVM entry modules when any EVM chain ships', () => {
        expect(stubbedChainModules(['algorand', 'polygon'])).toEqual([])
    })
})

describe('isChainPackageIncluded', () => {
    it.each([
        [['algorand', 'ethereum'], true],
        [['algorand', 'base'], true],
        [['polygon'], true],
        [['algorand'], false],
        [[], false],
    ])('reads %j as %s for the EVM package', (chainIds, expected) => {
        expect(isChainPackageIncluded(EVM_PACKAGE, chainIds)).toBe(expected)
    })
})

describe('chain package stubs', () => {
    it.each(
        CHAIN_PACKAGES.map(chainPackage => [
            chainPackage.package,
            chainPackage,
        ]),
    )(
        'maps every %s entry module to an existing stub beside it',
        (_name, chainPackage) => {
            const stubs = toStubMap(PROJECT_ROOT, [
                ...chainPackage.mobileStubbedModules,
            ])

            expect(Object.keys(stubs)).toHaveLength(
                chainPackage.mobileStubbedModules.length,
            )
            for (const [real, stub] of Object.entries(stubs)) {
                expect(existsSync(real)).toBe(true)
                expect(stub).toBe(real.replace(/\.ts$/, '.stub.ts'))
                expect(existsSync(stub)).toBe(true)
            }
        },
    )
})

describe('developer gallery stubs', () => {
    it('maps every gated module to an existing stub beside it', () => {
        const stubs = toStubMap(PROJECT_ROOT, DEVELOPER_GALLERY_MODULES)

        expect(Object.keys(stubs)).toHaveLength(
            DEVELOPER_GALLERY_MODULES.length,
        )
        for (const [real, stub] of Object.entries(stubs)) {
            expect(existsSync(real)).toBe(true)
            expect(stub).toBe(real.replace(/\.ts$/, '.stub.ts'))
            expect(existsSync(stub)).toBe(true)
        }
    })
})

describe('isE2eFixturesIncluded', () => {
    it('includes the fixtures only when E2E_FIXTURES is exactly 1', () => {
        expect(
            isE2eFixturesIncluded({
                e2eFixtures: '1',
                bakedAppEnvironment: 'staging',
            }),
        ).toBe(true)
    })

    it.each([undefined, '', '0', 'true', 'yes', ' 1'])(
        'stubs the fixtures for E2E_FIXTURES=%s',
        e2eFixtures => {
            expect(
                isE2eFixturesIncluded({
                    e2eFixtures,
                    bakedAppEnvironment: 'staging',
                }),
            ).toBe(false)
        },
    )

    it.each([
        ['production', undefined],
        [undefined, 'production'],
        ['staging', 'production'],
    ])(
        'refuses to build a production bundle with them (baked=%s, APP_ENV=%s)',
        (baked, appEnv) => {
            expect(() =>
                isE2eFixturesIncluded({
                    e2eFixtures: '1',
                    bakedAppEnvironment: baked,
                    appEnv,
                }),
            ).toThrow(/production/)
        },
    )

    it('stubs a production bundle that did not ask for them', () => {
        expect(
            isE2eFixturesIncluded({ bakedAppEnvironment: 'production' }),
        ).toBe(false)
    })
})

describe('e2e fixture stubs', () => {
    it('maps every gated module to an existing stub beside it', () => {
        const stubs = toStubMap(PROJECT_ROOT, E2E_FIXTURE_MODULES)

        expect(Object.keys(stubs)).toHaveLength(E2E_FIXTURE_MODULES.length)
        for (const [real, stub] of Object.entries(stubs)) {
            expect(existsSync(real)).toBe(true)
            expect(stub).toBe(real.replace(/\.ts$/, '.stub.ts'))
            expect(existsSync(stub)).toBe(true)
        }
    })
})

describe('isBenchBuild', () => {
    it('is on only when BENCH is exactly 1', () => {
        expect(
            isBenchBuild({ bench: '1', bakedAppEnvironment: 'staging' }),
        ).toBe(true)
    })

    it.each([undefined, '', '0', 'true', 'yes', ' 1'])(
        'is off for BENCH=%s',
        bench => {
            expect(
                isBenchBuild({ bench, bakedAppEnvironment: 'staging' }),
            ).toBe(false)
        },
    )

    it.each([
        ['production', undefined],
        [undefined, 'production'],
        ['staging', 'production'],
    ])(
        'refuses a production bundle (baked=%s, APP_ENV=%s)',
        (baked, appEnv) => {
            expect(() =>
                isBenchBuild({
                    bench: '1',
                    bakedAppEnvironment: baked,
                    appEnv,
                }),
            ).toThrow(/production/)
        },
    )

    it('stays off for a production bundle that did not ask for it', () => {
        expect(isBenchBuild({ bakedAppEnvironment: 'production' })).toBe(false)
    })
})
