import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ts from 'typescript'
import { loadChecks } from '../index.js'
import { sharedWalk } from '../execute.js'
import { findRepoRoot } from '../utils/discovery.js'
import type { SourceMap, Violation } from '../types.js'

const repoRoot = findRepoRoot(import.meta.url)

function runCli(extraArgs: string[] = []): {
    status: number | null
    stdout: string
    stderr: string
} {
    const result = spawnSync(
        'pnpm',
        [
            '--silent',
            '--filter',
            '@perawallet/wallet-core-devtools',
            'guardrails',
            ...extraArgs,
        ],
        { cwd: repoRoot, encoding: 'utf8' },
    )
    return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    }
}

describe('guardrails runner CLI', () => {
    it('runs all loaded checks end-to-end and exits 0 or 1 with a summary line', () => {
        const { status, stdout } = runCli()
        expect([0, 1]).toContain(status)
        if (status === 0) {
            expect(stdout).toContain('no violations')
        } else {
            expect(stdout).toMatch(/guardrail violation\(s\)/)
        }
    }, 30_000)

    it('emits valid JSON with timings for every loaded check when --json is passed', () => {
        const { status, stdout } = runCli(['--json'])
        expect([0, 1]).toContain(status)
        const payload = JSON.parse(stdout) as {
            ok: boolean
            total: number
            durationMs: number
            timings: Record<string, number>
            workers: number
            stageMs: { parse: number; walk: number }
        }
        expect(typeof payload.ok).toBe('boolean')
        expect(Number.isInteger(payload.total)).toBe(true)
        expect(payload.ok).toBe(payload.total === 0)
        expect(Number.isFinite(payload.durationMs)).toBe(true)
        expect(Number.isInteger(payload.workers)).toBe(true)
        expect(Number.isFinite(payload.stageMs.parse)).toBe(true)
        expect(Number.isFinite(payload.stageMs.walk)).toBe(true)
        const timingKeys = Object.keys(payload.timings)
        expect(timingKeys).toEqual(
            expect.arrayContaining([
                'no-numeric-sizes',
                'no-typography-in-styles',
                'no-primitive-rn-components',
            ]),
        )
    }, 30_000)

    it('exits 2 and reports unknown flag on stderr', () => {
        const { status, stderr } = runCli(['--nope'])
        expect(status).toBe(2)
        expect(stderr).toContain('unknown flag "--nope"')
    }, 30_000)

    it('exits 0 with --warn-only even when violations exist', () => {
        const { status, stdout } = runCli(['--warn-only'])
        expect(status).toBe(0)
        if (stdout.includes('guardrail violation(s)')) {
            expect(stdout).toContain('warn-only, not blocking')
        }
    }, 30_000)

    it('exposes warnOnly=true in JSON when combined with --json', () => {
        const { status, stdout } = runCli(['--json', '--warn-only'])
        expect(status).toBe(0)
        const payload = JSON.parse(stdout) as {
            ok: boolean
            total: number
            warnOnly: boolean
        }
        expect(payload.warnOnly).toBe(true)
    }, 30_000)
})

describe('loadChecks', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'guardrails-checks-'))
    })

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true })
    })

    it('returns [] when the checks directory does not exist', async () => {
        const nonExistent = join(tmpDir, 'does-not-exist')
        const checks = await loadChecks(
            new URL(`${pathToFileURL(nonExistent).href}/`),
        )
        expect(checks).toEqual([])
    })

    it('returns [] when the checks directory has no *.check.ts files', async () => {
        writeFileSync(join(tmpDir, 'helper.ts'), 'export const x = 1\n')
        const checks = await loadChecks(
            new URL(`${pathToFileURL(tmpDir).href}/`),
        )
        expect(checks).toEqual([])
    })

    it('loads a valid check module and runs it through sharedWalk', async () => {
        const checkPath = join(tmpDir, 'sample.check.ts')
        writeFileSync(
            checkPath,
            [
                "import ts from 'typescript'",
                'const check = {',
                "    id: 'sample-rule',",
                "    description: 'sample',",
                '    visitors: {',
                '        [ts.SyntaxKind.SourceFile]: (_node, _sf, emit) => {',
                "            emit({ line: 1, column: 1, message: 'nope', remediation: 'fix it' })",
                '        },',
                '    },',
                '}',
                'export default check',
                '',
            ].join('\n'),
        )

        const checks = await loadChecks(
            new URL(`${pathToFileURL(tmpDir).href}/`),
        )
        expect(checks).toHaveLength(1)
        expect(checks[0].id).toBe('sample-rule')

        const filePath = '/virtual/x.ts'
        const sources: SourceMap = new Map([
            [
                filePath,
                ts.createSourceFile(
                    filePath,
                    'const a = 1\n',
                    ts.ScriptTarget.Latest,
                    true,
                ),
            ],
        ])
        const violations: Violation[] = []
        sharedWalk(sources, checks, {}, violations)
        expect(violations).toHaveLength(1)
        expect(violations[0].ruleId).toBe('sample-rule')
    })

    it('throws a descriptive error when a check module is missing its default export', async () => {
        const badPath = join(tmpDir, 'bad.check.ts')
        writeFileSync(badPath, "export const notDefault = { id: 'x' }\n")

        await expect(
            loadChecks(new URL(`${pathToFileURL(tmpDir).href}/`)),
        ).rejects.toThrow(/bad\.check\.ts.*default export.*Check/)
    })

    it('throws a descriptive error when default export lacks required fields', async () => {
        const badPath = join(tmpDir, 'malformed.check.ts')
        writeFileSync(
            badPath,
            ["const broken = { id: 'x' }", 'export default broken', ''].join(
                '\n',
            ),
        )

        await expect(
            loadChecks(new URL(`${pathToFileURL(tmpDir).href}/`)),
        ).rejects.toThrow(/malformed\.check\.ts/)
    })
})
