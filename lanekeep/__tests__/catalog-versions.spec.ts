/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/catalog-versions.ts'
const WORKSPACE = 'pnpm-workspace.yaml'
const LOCK = 'pnpm-lock.yaml'

/** Catalog entries start on line 6. */
const workspaceYaml = (catalog: string[], overrides?: string[]): string =>
    [
        'packages:',
        '  - packages/*',
        '  - conformance',
        '',
        'catalog:',
        ...catalog,
        ...(overrides ? ['overrides:', ...overrides] : []),
        '',
    ].join('\n')

/** `snapshots` are raw lockfile lines, so a test can use quoted, peer-suffixed and `{}` keys. */
const lockfile = (
    catalog: Record<string, string>,
    snapshots: string[] = [],
): string =>
    [
        "lockfileVersion: '9.0'",
        '',
        'catalogs:',
        '  default:',
        ...Object.entries(catalog).flatMap(([name, version]) => [
            `    '${name}':`,
            `      specifier: ${version}`,
            `      version: ${version}`,
        ]),
        '',
        'snapshots:',
        '',
        ...snapshots,
        '',
    ].join('\n')

const manifest = (
    name: string,
    fields: Record<string, Record<string, string>> = {},
): string => JSON.stringify({ name, ...fields }, null, 4)

type Found = [file: string, line: number, message: string][]

const check = async (files: Record<string, string>): Promise<Found> =>
    withScratch(files, async dir => {
        const runner = await createRunner(RULE, `${dir}/${WORKSPACE}`)
        try {
            const violations = await runner.run()
            return violations.map(v => [
                v.file.slice(dir.length + 1),
                v.line,
                v.message,
            ])
        } finally {
            await runner.dispose()
        }
    })

const MARKER_GRAMMAR =
    "expected 'pin: lockstep <group>', 'pin: follows <catalog entry>' or 'pin: hold <version>'"

describe('pera/catalog-versions', () => {
    it('reports nothing for a workspace whose manifests and pins all hold', async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml(
                [
                    '  # Move together.',
                    '  # pin: lockstep fb',
                    '  fb-app: 1.0.0',
                    '  # pin: lockstep fb',
                    '  fb-msg: 1.0.0',
                    '  # The parent pins this exactly.',
                    '  # pin: follows parent',
                    '  child: 2.0.0',
                    '  parent: 3.0.0',
                    '  # Verified against this version.',
                    '  # pin: hold 2.57.7',
                    '  held: 2.57.7',
                    '  mirrored: ^1.0.0',
                    '  range: ^4.0.0',
                ],
                [
                    '  mirrored: ^1.0.0',
                    '  esbuild@<0.25.0: ">=0.25.0"',
                    '  a>b: 1.0.0',
                ],
            ),
            [LOCK]: lockfile(
                {
                    'fb-app': '1.0.0',
                    'fb-msg': '1.0.0',
                    child: '2.0.0',
                    parent: '3.0.0',
                    held: '2.57.7',
                    mirrored: '1.0.0',
                    range: '4.1.0',
                },
                [
                    "  'parent@3.0.0(typescript@7.0.2)':",
                    '    dependencies:',
                    '      child: 2.0.0(typescript@7.0.2)',
                    '',
                    '  child@2.0.0: {}',
                ],
            ),
            'package.json': manifest('root', {
                devDependencies: { range: 'catalog:' },
            }),
            'packages/app/package.json': manifest('app', {
                dependencies: {
                    'fb-app': 'catalog:',
                    child: 'catalog:default',
                    other: '^1.0.0',
                    local: 'workspace:*',
                },
                devDependencies: { held: 'catalog:' },
            }),
            'packages/empty/README.md': 'a member directory with no manifest\n',
            'conformance/package.json': manifest('conformance'),
            'tools/x/package.json': manifest('x', {
                dependencies: { range: '^4.0.0' },
            }),
        })

        expect(found).toEqual([])
    })

    it('flags a catalog dependency with its own spec in every dependency field of a member and of the root', async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml([
                '  a: 1.0.0',
                '  b: 1.0.0',
                '  c: 1.0.0',
                '  d: 1.0.0',
                '  e: 1.0.0',
            ]),
            'package.json': manifest('root', {
                devDependencies: { e: '^1.0.0' },
            }),
            'packages/app/package.json': manifest('app', {
                dependencies: { a: '^1.0.0' },
                devDependencies: { b: '1.0.0' },
                peerDependencies: { c: '*' },
                optionalDependencies: { d: '~1.0.0' },
            }),
        })

        expect(found).toEqual([
            [
                'package.json',
                4,
                "'e' has a catalog entry, so its spec must be 'catalog:', not '^1.0.0'",
            ],
            [
                'packages/app/package.json',
                4,
                "'a' has a catalog entry, so its spec must be 'catalog:', not '^1.0.0'",
            ],
            [
                'packages/app/package.json',
                7,
                "'b' has a catalog entry, so its spec must be 'catalog:', not '1.0.0'",
            ],
            [
                'packages/app/package.json',
                10,
                "'c' has a catalog entry, so its spec must be 'catalog:', not '*'",
            ],
            [
                'packages/app/package.json',
                13,
                "'d' has a catalog entry, so its spec must be 'catalog:', not '~1.0.0'",
            ],
        ])
    })

    it("flags a catalog entry that differs from its override, at the catalog's line", async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml(
                ['  mirrored: ^1.0.0', '  same: 2.0.0'],
                ['  mirrored: ^1.1.0', '  same: 2.0.0'],
            ),
        })

        expect(found).toEqual([
            [
                WORKSPACE,
                6,
                "'mirrored' is overridden to '^1.1.0', so the catalog's '^1.0.0' never installs; set both to the same spec",
            ],
        ])
    })

    it("flags a lockstep group that resolves to two versions once, at its first member's entry", async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml([
                '  # pin: lockstep g',
                '  a: 1.0.0',
                '  # pin: lockstep g',
                '  b: 1.1.0',
                '  # pin: lockstep g',
                '  c: 1.0.0',
            ]),
            [LOCK]: lockfile({ a: '1.0.0', b: '1.1.0', c: '1.0.0' }),
        })

        expect(found).toEqual([
            [
                WORKSPACE,
                7,
                "lockstep group 'g' resolves to more than one version: a 1.0.0, b 1.1.0, c 1.0.0",
            ],
        ])
    })

    describe('follows', () => {
        const catalog = [
            '  # pin: follows parent',
            '  child: 2.0.0',
            '  parent: 3.0.0',
        ]

        it('flags the child bumped on its own', async () => {
            const found = await check({
                [WORKSPACE]: workspaceYaml(catalog),
                [LOCK]: lockfile({ child: '2.1.0', parent: '3.0.0' }, [
                    '  parent@3.0.0:',
                    '    dependencies:',
                    '      child: 2.0.0',
                ]),
            })

            expect(found).toEqual([
                [
                    WORKSPACE,
                    7,
                    "'child' resolves to 2.1.0, but 'parent' 3.0.0 depends on 2.0.0; move the two together",
                ],
            ])
        })

        it('flags the parent moved to a release built on a newer child', async () => {
            const found = await check({
                [WORKSPACE]: workspaceYaml(catalog),
                [LOCK]: lockfile({ child: '2.0.0', parent: '3.1.0' }, [
                    '  parent@3.1.0:',
                    '    dependencies:',
                    '      child: 2.1.0',
                ]),
            })

            expect(found).toEqual([
                [
                    WORKSPACE,
                    7,
                    "'child' resolves to 2.0.0, but 'parent' 3.1.0 depends on 2.1.0; move the two together",
                ],
            ])
        })
    })

    it('flags a resolution above its hold, and one that is not a version', async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml([
                '  # pin: hold 2.57.7',
                '  held: 2.57.7',
                '  # pin: hold 1.0.0',
                '  odd: 1.0.0',
                '  # pin: hold 3.0.0',
                '  below: 3.0.0',
            ]),
            [LOCK]: lockfile({
                held: '2.57.10',
                odd: 'link:../x',
                below: '2.9.0',
            }),
        })

        expect(found).toEqual([
            [
                WORKSPACE,
                7,
                "'held' resolves to 2.57.10, above its hold at 2.57.7",
            ],
            [
                WORKSPACE,
                9,
                "'odd' resolves to 'link:../x', which is not a semver version to compare with its hold at 1.0.0",
            ],
        ])
    })

    it('flags a marker it cannot evaluate instead of skipping it', async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml(
                [
                    '  # pin: lockstep',
                    '  a: 1.0.0',
                    '  # pin: frobnicate x',
                    '  b: 1.0.0',
                    '  # pin: hold 1.0.0 extra',
                    '  c: 1.0.0',
                    '  # pin: hold 1.0.0',
                    '',
                    '  d: 1.0.0',
                    '  # pin: lockstep solo',
                    '  e: 1.0.0',
                    '  # pin: follows ghost',
                    '  f: 1.0.0',
                    '  # pin: follows h',
                    '  i: 1.0.0',
                    '  h: 1.0.0',
                    '  # pin: hold 1.0.0',
                    '  o: 1.0.0',
                ],
                ['  # pin: hold 1.0.0', '  x: 1.0.0', '  o: 1.0.0'],
            ),
            [LOCK]: lockfile({
                e: '1.0.0',
                f: '1.0.0',
                i: '1.0.0',
                h: '1.0.0',
            }),
        })

        expect(found).toEqual([
            [
                WORKSPACE,
                6,
                `'pin: lockstep' is not a pin marker: ${MARKER_GRAMMAR}`,
            ],
            [
                WORKSPACE,
                8,
                `'pin: frobnicate x' is not a pin marker: ${MARKER_GRAMMAR}`,
            ],
            [
                WORKSPACE,
                10,
                `'pin: hold 1.0.0 extra' is not a pin marker: ${MARKER_GRAMMAR}`,
            ],
            [
                WORKSPACE,
                12,
                "pin marker 'pin: hold 1.0.0' is not directly above a catalog entry",
            ],
            [
                WORKSPACE,
                15,
                "lockstep group 'solo' has only 'e'; a group needs at least two entries",
            ],
            [
                WORKSPACE,
                17,
                "'f' follows 'ghost', which pnpm-lock.yaml's catalog has no resolved version for",
            ],
            [
                WORKSPACE,
                19,
                "'h' 1.0.0 does not depend on 'i' in pnpm-lock.yaml",
            ],
            [
                WORKSPACE,
                23,
                "'o' has a pin marker, but pnpm-lock.yaml's catalog has no resolved version for it",
            ],
            [
                WORKSPACE,
                25,
                "pin marker 'pin: hold 1.0.0' is not directly above a catalog entry",
            ],
        ])
    })

    it('reports every marked entry when there is no lockfile, and still runs the other checks', async () => {
        const found = await check({
            [WORKSPACE]: workspaceYaml(
                [
                    '  # pin: hold 1.0.0',
                    '  a: 1.0.0',
                    '  # pin: lockstep g',
                    '  b: 1.0.0',
                    '  c: ^1.0.0',
                ],
                ['  c: ^1.0.1'],
            ),
            'packages/app/package.json': manifest('app', {
                dependencies: { a: '^1.0.0' },
            }),
        })

        expect(found).toEqual([
            [
                'packages/app/package.json',
                4,
                "'a' has a catalog entry, so its spec must be 'catalog:', not '^1.0.0'",
            ],
            [
                WORKSPACE,
                7,
                "'a' has a pin marker, but pnpm-lock.yaml's catalog has no resolved version for it",
            ],
            [
                WORKSPACE,
                9,
                "'b' has a pin marker, but pnpm-lock.yaml's catalog has no resolved version for it",
            ],
            [
                WORKSPACE,
                10,
                "'c' is overridden to '^1.0.1', so the catalog's '^1.0.0' never installs; set both to the same spec",
            ],
        ])
    })

    it('reports at the first non-space column of the offending line', async () => {
        const runs = await withScratch(
            {
                [WORKSPACE]: workspaceYaml(['  # pin: nope', '  a: 1.0.0']),
                'packages/app/package.json': manifest('app', {
                    dependencies: { a: '^1.0.0' },
                }),
            },
            async dir => {
                const runner = await createRunner(RULE, `${dir}/${WORKSPACE}`)
                try {
                    return await runner.run()
                } finally {
                    await runner.dispose()
                }
            },
        )

        expect(runs.map(v => [v.line, v.column])).toEqual([
            [4, 9],
            [6, 3],
        ])
    })
})
