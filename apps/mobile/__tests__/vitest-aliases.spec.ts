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

import fs from 'fs'
import { createRequire } from 'module'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    stripJsonComments,
    tsconfigPathAliases,
    workspaceSourceAliases,
} from '../vitest.aliases'

const MOBILE_ROOT = path.resolve(__dirname, '..')
const MONOREPO_ROOT = path.resolve(MOBILE_ROOT, '../..')

let fixtureRoot: string

const writeFile = (relativePath: string, contents = ''): void => {
    const target = path.join(fixtureRoot, relativePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, contents)
}

const writePackage = (
    dir: string,
    name: string,
    exports: Record<string, unknown>,
    sourceFiles: string[],
): void => {
    writeFile(`${dir}/package.json`, JSON.stringify({ name, exports }))
    for (const file of sourceFiles) writeFile(`${dir}/src/${file}`)
}

beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-aliases-'))
})

afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('workspaceSourceAliases', () => {
    it('maps the root, each export subpath and test-handlers to source', () => {
        writePackage(
            'packages/alpha',
            '@scope/alpha',
            { '.': {}, './constants': {}, './queue': {} },
            ['index.ts', 'constants.ts', 'queue/index.ts', 'test-handlers.ts'],
        )

        const aliases = workspaceSourceAliases({
            packageRoots: [path.join(fixtureRoot, 'packages')],
        })

        const src = path.join(fixtureRoot, 'packages/alpha/src')
        expect(aliases).toEqual([
            {
                find: '@scope/alpha/test-handlers',
                replacement: path.join(src, 'test-handlers.ts'),
            },
            {
                find: '@scope/alpha/constants',
                replacement: path.join(src, 'constants.ts'),
            },
            {
                find: '@scope/alpha/queue',
                replacement: path.join(src, 'queue/index.ts'),
            },
            { find: '@scope/alpha', replacement: path.join(src, 'index.ts') },
        ])
    })

    it('maps test-handlers beside a directory-barrel subpath ahead of that subpath', () => {
        writePackage(
            'packages/chain',
            '@scope/chain',
            { '.': {}, './card': {} },
            ['index.ts', 'card/index.ts', 'card/test-handlers.ts'],
        )

        const aliases = workspaceSourceAliases({
            packageRoots: [path.join(fixtureRoot, 'packages')],
        })

        const src = path.join(fixtureRoot, 'packages/chain/src')
        expect(aliases).toEqual([
            {
                find: '@scope/chain/card/test-handlers',
                replacement: path.join(src, 'card/test-handlers.ts'),
            },
            {
                find: '@scope/chain/card',
                replacement: path.join(src, 'card/index.ts'),
            },
            { find: '@scope/chain', replacement: path.join(src, 'index.ts') },
        ])
    })

    it('orders every subpath ahead of a root that would prefix-match it', () => {
        writePackage('packages/a', '@scope/a', { '.': {} }, ['index.ts'])
        writePackage(
            'packages/b',
            '@scope/a-longer-name',
            { '.': {}, './x': {} },
            ['index.ts', 'x.ts'],
        )

        const finds = workspaceSourceAliases({
            packageRoots: [path.join(fixtureRoot, 'packages')],
        }).map(({ find }) => find)

        expect(finds.indexOf('@scope/a-longer-name/x')).toBeLessThan(
            finds.indexOf('@scope/a-longer-name'),
        )
    })

    it('skips tooling packages without src, skipped packages and skipped specifiers', () => {
        writeFile(
            'packages/tooling/package.json',
            JSON.stringify({ name: '@scope/tooling', exports: { './x': {} } }),
        )
        writePackage('packages/stubbed', '@scope/stubbed', { '.': {} }, [
            'index.ts',
        ])
        writePackage('packages/half', '@scope/half', { '.': {} }, [
            'index.ts',
            'test-handlers.ts',
        ])

        const finds = workspaceSourceAliases({
            packageRoots: [path.join(fixtureRoot, 'packages')],
            skipPackages: new Set(['@scope/stubbed']),
            skipSpecifiers: new Set(['@scope/half']),
        }).map(({ find }) => find)

        expect(finds).toEqual(['@scope/half/test-handlers'])
    })

    it('throws when an export has no matching source file', () => {
        writePackage(
            'packages/broken',
            '@scope/broken',
            { '.': {}, './gone': {} },
            ['index.ts'],
        )

        expect(() =>
            workspaceSourceAliases({
                packageRoots: [path.join(fixtureRoot, 'packages')],
            }),
        ).toThrow(/No source file for export "\.\/gone"/)
    })

    it('resolves every alias for this repo to a file that exists', () => {
        const aliases = workspaceSourceAliases({
            packageRoots: [
                path.join(MONOREPO_ROOT, 'packages'),
                path.join(MONOREPO_ROOT, 'extensions'),
            ],
        })

        expect(aliases.length).toBeGreaterThan(0)
        for (const { replacement } of aliases) {
            expect(fs.existsSync(replacement)).toBe(true)
        }
    })
})

describe('stripJsonComments', () => {
    it('drops comments and trailing commas but keeps slashes inside strings', () => {
        const text = `{
            // line comment
            "url": "https://example.com/a", /* block */
            "list": ["x",],
        }`

        expect(JSON.parse(stripJsonComments(text))).toEqual({
            url: 'https://example.com/a',
            list: ['x'],
        })
    })
})

describe('tsconfigPathAliases', () => {
    it('turns app path wildcards into directory aliases and skips package entries', () => {
        writeFile(
            'app/tsconfig.json',
            `{
              "compilerOptions": {
                "paths": {
                  // comment
                  "@components/*": ["./src/components/*"],
                  "@analytics": ["./src/analytics"],
                  "@analytics/*": ["./src/analytics/*"],
                  "@perawallet/pkg/test-handlers": ["../pkg/src/test-handlers.ts"],
                },
              },
            }`,
        )

        const aliases = tsconfigPathAliases(
            path.join(fixtureRoot, 'app/tsconfig.json'),
        )

        expect(aliases).toEqual([
            {
                find: '@components',
                replacement: path.join(fixtureRoot, 'app/src/components'),
            },
            {
                find: '@analytics',
                replacement: path.join(fixtureRoot, 'app/src/analytics'),
            },
        ])
    })

    it('agrees with every alias Babel resolves for the app bundle', () => {
        const babelConfigFactory = createRequire(__filename)(
            path.join(MOBILE_ROOT, 'babel.config.js'),
        ) as (api: { cache: (value: boolean) => void }) => {
            plugins: unknown[]
        }
        const { plugins } = babelConfigFactory({ cache: () => undefined })
        const moduleResolver = plugins.find(
            plugin => Array.isArray(plugin) && plugin[0] === 'module-resolver',
        ) as [string, { alias: Record<string, string> }]
        const tsconfigAliases = new Map(
            tsconfigPathAliases(path.join(MOBILE_ROOT, 'tsconfig.json')).map(
                ({ find, replacement }) => [find, replacement],
            ),
        )

        for (const [find, target] of Object.entries(moduleResolver[1].alias)) {
            expect(tsconfigAliases.get(find)).toBe(
                path.resolve(MOBILE_ROOT, target),
            )
        }
    })
})
