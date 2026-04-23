import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadChecks } from '../index.js'
import { findRepoRoot } from '../utils/discovery.js'
import type { SourceMap } from '../types.js'

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
    it('exits 0 with "no violations" human output when no checks exist', () => {
        const { status, stdout } = runCli()
        expect(status).toBe(0)
        expect(stdout).toContain('no violations')
    }, 30_000)

    it('emits valid JSON with ok=true when --json is passed', () => {
        const { status, stdout } = runCli(['--json'])
        expect(status).toBe(0)
        const payload = JSON.parse(stdout) as {
            ok: boolean
            total: number
            timings: Record<string, number>
        }
        expect(payload.ok).toBe(true)
        expect(payload.total).toBe(0)
        expect(payload.timings).toEqual({})
    }, 30_000)

    it('exits 2 and reports unknown flag on stderr', () => {
        const { status, stderr } = runCli(['--nope'])
        expect(status).toBe(2)
        expect(stderr).toContain('unknown flag "--nope"')
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

    it('loads a valid check module and exposes its run function', async () => {
        const checkPath = join(tmpDir, 'sample.check.ts')
        writeFileSync(
            checkPath,
            [
                'const check = {',
                "    id: 'sample-rule',",
                "    description: 'sample',",
                '    run() {',
                '        return [',
                '            {',
                "                file: '/virtual/a.ts',",
                '                line: 1,',
                '                column: 1,',
                "                ruleId: 'sample-rule',",
                "                message: 'nope',",
                "                remediation: 'fix it',",
                '            },',
                '        ]',
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

        const sources: SourceMap = new Map()
        const violations = await checks[0].run(sources)
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
