/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const REPO_ROOT = resolve(import.meta.dirname, '../..')
const BIN = join(REPO_ROOT, 'node_modules/.bin/lanekeep')

export interface Violation {
    ruleId: string
    file: string
    line: number
    column: number
    message: string
}

/** The shape `lanekeep check --format json` actually emits, ahead of the flatter `Violation`. */
interface RawViolation {
    rule_id: string
    location: {
        file: string
        position: { line: number; column: number }
    }
    message: string
}

export interface Runner {
    /** Violations over the glob, sorted by file, line and column. */
    run(): Promise<Violation[]>
    /** Applies the rule's safe fixes in place. */
    fix(): Promise<void>
    dispose(): Promise<void>
}

/**
 * One rule over one glob. The fixtures live inside the repo but must not be
 * scanned by the real config, so each runner writes its own config to a temp
 * directory pointing back at them. Reusing a runner keeps lanekeep's cache
 * warm between calls.
 */
export async function createRunner(
    rulePath: string,
    glob: string,
): Promise<Runner> {
    const dir = await mkdtemp(join(tmpdir(), 'lanekeep-fixture-'))
    const configPath = join(dir, 'lanekeep.json')
    const config = {
        include: [glob],
        exclude: [],
        namespaces: ['pera'],
        // lanekeep's rule loader only accepts a path `./`- or `../`-prefixed,
        // resolved against the project-root argument passed to `check`; an
        // absolute path is rejected and fails the whole run opaquely.
        rules: [rulePath.startsWith('.') ? rulePath : `./${rulePath}`],
    }
    await writeFile(configPath, JSON.stringify(config, null, 2))

    // Exit code 1 means violations were found, which is the normal case
    // here; only exit 2 is a tool error worth surfacing.
    const check = (args: string[]) =>
        execFileAsync(
            BIN,
            ['check', REPO_ROOT, '--config', configPath, ...args],
            { maxBuffer: 32 * 1024 * 1024 },
        ).catch((err: { code?: number; stdout?: string; stderr?: string }) => {
            if (err.code === 1 && err.stdout !== undefined) {
                return { stdout: err.stdout }
            }
            throw new Error(`lanekeep failed: ${err.stderr ?? 'unknown'}`)
        })

    return {
        async run() {
            const { stdout } = await check(['--format', 'json'])
            const parsed = JSON.parse(stdout) as { violations: RawViolation[] }
            return parsed.violations
                .map(v => ({
                    ruleId: v.rule_id,
                    file: v.location.file,
                    line: v.location.position.line,
                    column: v.location.position.column,
                    message: v.message,
                }))
                .sort(
                    (a, b) =>
                        a.file.localeCompare(b.file) ||
                        a.line - b.line ||
                        a.column - b.column,
                )
        },
        async fix() {
            await check(['--fix'])
        },
        dispose: () => rm(dir, { recursive: true, force: true }),
    }
}

/** Runs one rule over the fixtures matching `fixtureGlob`. */
export async function runRule(
    rulePath: string,
    fixtureGlob: string,
): Promise<Violation[]> {
    const runner = await createRunner(rulePath, fixtureGlob)
    try {
        return await runner.run()
    } finally {
        await runner.dispose()
    }
}

/**
 * Writes `files` into a fresh scratch directory and hands `run` its
 * repo-relative path. Inside the repo because lanekeep reads only under its
 * project root; not dot-prefixed and not gitignored, so discovery sees it.
 * lanekeep.config.ts excludes `scratch-*`; a runner's config does not.
 */
export async function withScratch<T>(
    files: Record<string, string>,
    run: (dir: string) => Promise<T>,
): Promise<T> {
    const abs = await mkdtemp(join(REPO_ROOT, 'lanekeep/__tests__/scratch-'))
    try {
        for (const [path, content] of Object.entries(files)) {
            await mkdir(dirname(join(abs, path)), { recursive: true })
            await writeFile(join(abs, path), content)
        }
        return await run(relative(REPO_ROOT, abs))
    } finally {
        await rm(abs, { recursive: true, force: true })
    }
}

/**
 * `file:line` pairs, the form assertions read most clearly. Strips to the
 * basename, so fixture filenames must stay unique across `__tests__/fixtures/`
 * subdirectories or two unrelated violations will collide on the same key.
 */
export const locations = (violations: Violation[]): string[] =>
    violations.map(v => `${v.file.split('/').pop()}:${v.line}`)
