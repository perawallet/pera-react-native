/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { createRunner, withScratch } from './helpers.js'

const RULE = 'lanekeep/rules/single-copy-packages.ts'
const WORKSPACE = 'pnpm-workspace.yaml'
const LOCK = 'pnpm-lock.yaml'

type Found = [file: string, line: number, message: string][]

const lockfile = (snapshots: string[]): string =>
    ["lockfileVersion: '9.0'", '', 'snapshots:', '', ...snapshots, ''].join(
        '\n',
    )

/** The 1-based line of the snapshot entry whose key line is exactly `key`. */
const lineOf = (lock: string, key: string): number =>
    lock.split('\n').indexOf(key) + 1

const CURVES_1 = "  '@noble/curves@1.9.7':"
const CURVES_2 = "  '@noble/curves@2.4.0':"
const HASHES_1 = "  '@noble/hashes@1.8.0': {}"
const HASHES_2 = "  '@noble/hashes@2.4.0': {}"
const OX_A = '  ox@0.14.56(typescript@5.9.3)(zod@4.1.0):'
const OX_B = '  ox@0.14.56(typescript@5.9.3):'
const VIEM = '  viem@2.57.7(typescript@5.9.3):'

const clean = (): string[] => [
    CURVES_1,
    '    dependencies:',
    "      '@noble/hashes': 1.8.0",
    CURVES_2,
    '    dependencies:',
    "      '@noble/hashes': 2.4.0",
    HASHES_1,
    HASHES_2,
    OX_A,
    '    dependencies:',
    "      '@noble/curves': 1.9.7",
    OX_B,
    '    dependencies:',
    "      '@noble/curves': 1.9.7",
    VIEM,
    '    dependencies:',
    '      ox: 0.14.56(typescript@5.9.3)',
]

const without = (snapshots: string[], header: string): string[] => {
    const at = snapshots.indexOf(header)
    if (at === -1) throw new Error(`no snapshot ${header}`)
    let end = at + 1
    while (snapshots[end]?.startsWith('    ')) end++
    return [...snapshots.slice(0, at), ...snapshots.slice(end)]
}

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

const run = (snapshots: string[]): Promise<Found> =>
    check({
        [WORKSPACE]: 'packages:\n  - packages/*\n',
        [LOCK]: lockfile(snapshots),
    })

const COLLAPSE =
    'collapse them with an override in pnpm-workspace.yaml, or add a split with its reason to SINGLE_COPY_PACKAGES'

describe('pera/single-copy-packages', () => {
    it('reports nothing for one copy per allowed line, a release under two peer sets counting once', async () => {
        const found = await run(clean())

        expect(found).toEqual([])
    })

    it('reports a second ox, naming the dependents of each copy', async () => {
        const wcUtils = "  '@walletconnect/utils@2.25.0(zod@4.1.0)':"
        const ox = '  ox@0.9.3(typescript@5.9.3):'
        const snapshots = [
            ...clean(),
            ox,
            '    dependencies:',
            "      '@noble/curves': 1.9.7",
            wcUtils,
            '    dependencies:',
            '      ox: 0.9.3(typescript@5.9.3)',
        ]

        const found = await run(snapshots)

        expect(found).toEqual([
            [
                LOCK,
                lineOf(lockfile(snapshots), ox),
                "'ox' resolves to 2 versions: 0.9.3 (from @walletconnect/utils@2.25.0), 0.14.56 (from viem@2.57.7); " +
                    COLLAPSE,
            ],
        ])
    })

    it('reports a second copy on one allowed major', async () => {
        const old = "  '@noble/curves@1.9.1':"
        const snapshots = [...clean(), old, '    dependencies:', '      x: 1']

        const found = await run(snapshots)

        expect(found).toEqual([
            [
                LOCK,
                lineOf(lockfile(snapshots), old),
                "'@noble/curves' resolves to 2 versions on 1.x: 1.9.1 (from a workspace package), 1.9.7 (from ox@0.14.56); " +
                    COLLAPSE,
            ],
        ])
    })

    it('reports a copy on a major the split does not allow', async () => {
        const next = "  '@noble/hashes@3.0.0': {}"
        const snapshots = [...clean(), next]

        const found = await run(snapshots)

        expect(found).toEqual([
            [
                LOCK,
                lineOf(lockfile(snapshots), next),
                "'@noble/hashes' 3.0.0 (from a workspace package) is on 3.x, outside its allowed 1.x and 2.x; move it onto an allowed line with an override, or add 3.x to its split with the reason",
            ],
        ])
    })

    it('reports an allowed major that no longer resolves', async () => {
        const found = await run(without(clean(), HASHES_1))

        expect(found).toEqual([
            [
                LOCK,
                1,
                "'@noble/hashes' no longer resolves on 1.x; drop 1.x from its split in SINGLE_COPY_PACKAGES",
            ],
        ])
    })

    it('reports a listed package the lockfile no longer has', async () => {
        const found = await run(
            without(without(without(clean(), VIEM), OX_A), OX_B),
        )

        expect(found).toEqual([
            [
                LOCK,
                1,
                "'ox' is not in pnpm-lock.yaml; drop it from SINGLE_COPY_PACKAGES",
            ],
        ])
    })

    it('reports a missing lockfile instead of passing', async () => {
        const found = await check({
            [WORKSPACE]: 'packages:\n  - packages/*\n',
        })

        expect(found).toEqual([
            [
                WORKSPACE,
                1,
                'pnpm-lock.yaml is missing beside pnpm-workspace.yaml, so no package can be checked for a second copy',
            ],
        ])
    })
})
