/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const BIN = join(REPO_ROOT, 'node_modules/.bin/lanekeep')

export interface Violation {
    ruleId: string
    file: string
    line: number
    column: number
    message: string
}

/**
 * Runs one rule over the fixture directory and returns its violations, sorted.
 *
 * The fixtures live inside the repo but must not be scanned by the real config,
 * so the run uses a generated config in a temp directory pointing back at them.
 */
export async function runRule(
    rulePath: string,
    fixtureGlob: string,
): Promise<Violation[]> {
    const dir = await mkdtemp(join(tmpdir(), 'lanekeep-fixture-'))
    try {
        const config = {
            include: [fixtureGlob],
            exclude: [],
            namespaces: ['pera'],
            rules: [join(REPO_ROOT, rulePath)],
        }
        const configPath = join(dir, 'lanekeep.json')
        await writeFile(configPath, JSON.stringify(config, null, 2))

        // Exit code 1 means violations were found, which is the normal case
        // here; only exit 2 is a tool error worth surfacing.
        const { stdout } = await execFileAsync(
            BIN,
            ['check', REPO_ROOT, '--config', configPath, '--format', 'json'],
            { maxBuffer: 32 * 1024 * 1024 },
        ).catch((err: { code?: number; stdout?: string; stderr?: string }) => {
            if (err.code === 1 && err.stdout !== undefined) {
                return { stdout: err.stdout }
            }
            throw new Error(`lanekeep failed: ${err.stderr ?? 'unknown'}`)
        })

        const parsed = JSON.parse(stdout) as { violations: Violation[] }
        return parsed.violations.sort(
            (a, b) =>
                a.file.localeCompare(b.file) ||
                a.line - b.line ||
                a.column - b.column,
        )
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
}

/** `file:line` pairs, the form assertions read most clearly. */
export const locations = (violations: Violation[]): string[] =>
    violations.map(v => `${v.file.split('/').pop()}:${v.line}`)
