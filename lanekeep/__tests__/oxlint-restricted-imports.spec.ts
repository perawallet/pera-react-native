/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const BIN = join(REPO_ROOT, 'node_modules/.bin/oxlint')
const RULE = 'no-restricted-imports'

type RuleConfig = Record<string, unknown>
type Override = { files: string[]; rules: RuleConfig }
type Diagnostic = { code: string; severity: string; filename: string }

// Fixtures bind to a new const rather than `export { x }`: oxlint reports a
// re-exported import binding twice, which would muddy the counts below.
const FIXTURES: Record<string, string> = {
    'packages/accounts/src/sdk.ts':
        "import algosdk from 'algosdk'\nexport const sdk = algosdk\n",
    'packages/accounts/src/subpath.ts':
        "import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'\nexport const amount = AlgoAmount\n",
    'packages/accounts/src/keystore.ts': [
        "import * as keystore from '@algorandfoundation/keystore-core'",
        "import * as xhd from '@algorandfoundation/xhd-wallet-api'",
        'export const platform = [keystore, xhd]',
        '',
    ].join('\n'),
    'packages/blockchain/src/models/index.ts':
        "export type { Transaction } from 'algosdk'\n",
    'packages/chain-algorand/src/index.ts':
        "import algosdk from 'algosdk'\nexport const sdk = algosdk\n",
}

// The real config can't run from a temp dir (its jsPlugins and type-aware
// options resolve relative to it), so lift just this rule and its overrides;
// override globs stay relative to the config, so the fixture tree mirrors the repo.
async function restrictedImportsConfig() {
    const raw = await readFile(join(REPO_ROOT, '.oxlintrc.json'), 'utf8')
    const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')) as {
        rules: RuleConfig
        overrides: Override[]
    }
    return {
        rules: { [RULE]: config.rules[RULE] },
        overrides: config.overrides
            .filter(o => RULE in o.rules)
            .map(o => ({ files: o.files, rules: { [RULE]: o.rules[RULE] } })),
    }
}

describe('oxlint no-restricted-imports (Algorand SDK)', () => {
    let dir: string
    let diagnostics: Diagnostic[]

    const findingsFor = (file: string) =>
        diagnostics.filter(
            d => d.filename.endsWith(file) && d.code.includes(RULE),
        )

    beforeAll(async () => {
        dir = await mkdtemp(join(tmpdir(), 'oxlint-restricted-'))
        await writeFile(
            join(dir, '.oxlintrc.json'),
            JSON.stringify(await restrictedImportsConfig()),
        )
        for (const [file, source] of Object.entries(FIXTURES)) {
            await mkdir(dirname(join(dir, file)), { recursive: true })
            await writeFile(join(dir, file), source)
        }
        // Resolves only on exit 0, so this also pins that the findings never fail lint.
        const { stdout } = await execFileAsync(
            BIN,
            ['--config', '.oxlintrc.json', '-f', 'json', 'packages'],
            { cwd: dir },
        )
        diagnostics = (JSON.parse(stdout) as { diagnostics: Diagnostic[] })
            .diagnostics
    })

    afterAll(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    it('warns on an algosdk import outside chain-algorand', () => {
        expect(findingsFor('accounts/src/sdk.ts').map(d => d.severity)).toEqual(
            ['warning'],
        )
    })

    it('warns on an algokit-utils subpath import', () => {
        expect(findingsFor('accounts/src/subpath.ts')).toHaveLength(1)
    })

    it('ignores the platform-layer @algorandfoundation packages', () => {
        expect(findingsFor('accounts/src/keystore.ts')).toEqual([])
    })

    it('allows the SDK in chain-algorand and the blockchain models barrel', () => {
        expect(findingsFor('blockchain/src/models/index.ts')).toEqual([])
        expect(findingsFor('chain-algorand/src/index.ts')).toEqual([])
    })
})
