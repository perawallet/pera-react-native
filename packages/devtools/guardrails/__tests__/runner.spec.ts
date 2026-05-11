import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import ts from 'typescript'
import { loadChecks, runGuardrails } from '../index.js'
import { sharedWalk } from '../execute.js'
import { findRepoRoot } from '../utils/discovery.js'
import type { SourceMap, Violation } from '../types.js'

const DIRTY_SOURCE = [
    "import { makeStyles } from '@rneui/themed'",
    'export const useStyles = makeStyles(() => ({',
    '    box: { padding: 16 },',
    '}))',
    '',
].join('\n')

const CLEAN_SOURCE = 'export const x = 1\n'

function buildFixture(): { root: string; cleanup: () => void } {
    const root = mkdtempSync(join(tmpdir(), 'guardrails-fixture-'))
    mkdirSync(join(root, 'apps/mobile/src'), { recursive: true })
    mkdirSync(join(root, 'packages/foo/src'), { recursive: true })
    writeFileSync(join(root, 'apps/mobile/src/clean.ts'), CLEAN_SOURCE)
    writeFileSync(join(root, 'apps/mobile/src/dirty.ts'), DIRTY_SOURCE)
    writeFileSync(join(root, 'packages/foo/src/another.ts'), CLEAN_SOURCE)
    return {
        root,
        cleanup: () => rmSync(root, { recursive: true, force: true }),
    }
}

describe('runGuardrails (in-process)', () => {
    let fixtureRoot: string
    let cleanup: () => void

    beforeAll(() => {
        const fixture = buildFixture()
        fixtureRoot = fixture.root
        cleanup = fixture.cleanup
    })

    afterAll(() => {
        cleanup()
    })

    it('reports violations and exits 1 when the fixture has a numeric size', async () => {
        const { output, exitCode, summary } = await runGuardrails({
            repoRoot: fixtureRoot,
            args: [],
        })
        expect(exitCode).toBe(1)
        expect(output).toMatch(/guardrail violation\(s\)/)
        expect(output).toContain('no-numeric-sizes')
        expect(
            summary.violations.some(v => v.ruleId === 'no-numeric-sizes'),
        ).toBe(true)
    })

    it('emits valid JSON with timings for every loaded check when --json is passed', async () => {
        const { output, exitCode } = await runGuardrails({
            repoRoot: fixtureRoot,
            args: ['--json'],
        })
        expect([0, 1]).toContain(exitCode)
        const payload = JSON.parse(output) as {
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
        expect(Object.keys(payload.timings)).toEqual(
            expect.arrayContaining([
                'no-numeric-sizes',
                'no-typography-in-styles',
                'no-primitive-rn-components',
            ]),
        )
    })

    it('throws on unknown flag', async () => {
        await expect(
            runGuardrails({ repoRoot: fixtureRoot, args: ['--nope'] }),
        ).rejects.toThrow(/unknown flag "--nope"/)
    })

    it('exits 0 with --warn-only even when violations exist', async () => {
        const { output, exitCode } = await runGuardrails({
            repoRoot: fixtureRoot,
            args: ['--warn-only'],
        })
        expect(exitCode).toBe(0)
        expect(output).toContain('guardrail violation(s)')
        expect(output).toContain('warn-only, not blocking')
    })

    it('exposes warnOnly=true in JSON when combined with --json', async () => {
        const { output, exitCode } = await runGuardrails({
            repoRoot: fixtureRoot,
            args: ['--json', '--warn-only'],
        })
        expect(exitCode).toBe(0)
        const payload = JSON.parse(output) as {
            ok: boolean
            total: number
            warnOnly: boolean
        }
        expect(payload.warnOnly).toBe(true)
    })

    it('engages workers when GUARDRAILS_FORCE_WORKERS=1', async () => {
        const previous = process.env.GUARDRAILS_FORCE_WORKERS
        process.env.GUARDRAILS_FORCE_WORKERS = '1'
        try {
            const { exitCode, summary } = await runGuardrails({
                repoRoot: fixtureRoot,
                args: ['--json'],
            })
            expect([0, 1]).toContain(exitCode)
            expect(summary.workers).toBeGreaterThan(0)
            expect(Number.isFinite(summary.parseMs)).toBe(true)
            expect(Number.isFinite(summary.walkMs)).toBe(true)
        } finally {
            if (previous === undefined) {
                delete process.env.GUARDRAILS_FORCE_WORKERS
            } else {
                process.env.GUARDRAILS_FORCE_WORKERS = previous
            }
        }
    })
})

describe('guardrails CLI bin (subprocess smoke)', () => {
    it('runs end-to-end via pnpm and emits a valid JSON summary', () => {
        const repoRoot = findRepoRoot(import.meta.url)
        const result = spawnSync(
            'pnpm',
            [
                '--silent',
                '--filter',
                '@perawallet/wallet-core-devtools',
                'guardrails',
                '--json',
            ],
            { cwd: repoRoot, encoding: 'utf8' },
        )
        expect([0, 1]).toContain(result.status)
        const payload = JSON.parse(result.stdout ?? '') as {
            ok: boolean
            total: number
            timings: Record<string, number>
        }
        expect(typeof payload.ok).toBe('boolean')
        expect(Object.keys(payload.timings).length).toBeGreaterThan(0)
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

describe('worker bootstrap', () => {
    it('parses, walks, and returns violations for a file chunk', async () => {
        const workerUrl = new URL('../worker-entry.mjs', import.meta.url)
        const checksDirHref = new URL('../checks/', import.meta.url).href
        const repoRoot = findRepoRoot(import.meta.url)
        const result = await new Promise<{
            kind: string
            result?: { violations: unknown[] }
            message?: string
        }>((resolve, reject) => {
            const worker = new Worker(fileURLToPath(workerUrl), {
                workerData: { checksDirHref },
            })
            worker.on('message', msg => {
                resolve(msg)
                worker.terminate()
            })
            worker.on('error', reject)
            worker.on('exit', code => {
                if (code !== 0 && code !== null) {
                    reject(new Error(`worker exited ${code}`))
                }
            })
            worker.postMessage({
                paths: [join(repoRoot, 'apps/mobile/src/App.tsx')],
            })
        })
        expect(result.kind).toBe('ok')
        expect(Array.isArray(result.result?.violations)).toBe(true)
    }, 30_000)
})
