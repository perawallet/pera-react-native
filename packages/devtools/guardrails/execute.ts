import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { filterSuppressed } from './utils/suppressions.js'
import type {
    Check,
    CheckVisitor,
    EmitViolation,
    SourceMap,
    Violation,
} from './types.js'

export interface KindHandler {
    check: Check
    visitor: CheckVisitor
}

export type KindIndex = Map<ts.SyntaxKind, KindHandler[]>

export function buildKindIndex(checks: Check[]): KindIndex {
    const index: KindIndex = new Map()
    for (const check of checks) {
        for (const [kindStr, visitor] of Object.entries(check.visitors)) {
            if (!visitor) continue
            const kind = Number(kindStr) as ts.SyntaxKind
            const bucket = index.get(kind)
            if (bucket) {
                bucket.push({ check, visitor })
            } else {
                index.set(kind, [{ check, visitor }])
            }
        }
    }
    return index
}

export function sharedWalk(
    sources: SourceMap,
    checks: Check[],
    timings: Record<string, number>,
    out: Violation[],
): void {
    const kindIndex = buildKindIndex(checks)
    for (const sf of sources.values()) {
        const visit = (node: ts.Node): void => {
            const handlers = kindIndex.get(node.kind)
            if (handlers) {
                for (const { check, visitor } of handlers) {
                    const emit: EmitViolation = payload => {
                        out.push({
                            ...payload,
                            ruleId: check.id,
                            file: sf.fileName,
                        })
                    }
                    const t0 = performance.now()
                    visitor(node, sf, emit)
                    timings[check.id] =
                        (timings[check.id] ?? 0) + (performance.now() - t0)
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sf)
    }
}

export interface ChunkResult {
    violations: Violation[]
    timings: Record<string, number>
    parseMs: number
    walkMs: number
}

function scriptKindFor(path: string): ts.ScriptKind {
    return path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

export async function runChecksAgainstPaths(
    paths: string[],
    checks: Check[],
): Promise<ChunkResult> {
    const parseStart = performance.now()
    const sourceFiles = await Promise.all(
        paths.map(async path => {
            const text = await readFile(path, 'utf8')
            return ts.createSourceFile(
                path,
                text,
                ts.ScriptTarget.Latest,
                true,
                scriptKindFor(path),
            )
        }),
    )
    const sources: SourceMap = new Map()
    for (const sf of sourceFiles) sources.set(sf.fileName, sf)
    const parseMs = performance.now() - parseStart

    const walkStart = performance.now()
    const timings: Record<string, number> = {}
    const raw: Violation[] = []
    sharedWalk(sources, checks, timings, raw)
    for (const check of checks) {
        if (!check.finalize) continue
        const t0 = performance.now()
        check.finalize({
            sources,
            emit: payload => {
                raw.push({ ...payload, ruleId: check.id })
            },
        })
        timings[check.id] = (timings[check.id] ?? 0) + (performance.now() - t0)
    }
    const walkMs = performance.now() - walkStart

    // Set by the differential harness so both tools compare on the same
    // unsuppressed corpus. Deleted with this package.
    const violations =
        process.env.GUARDRAILS_NO_SUPPRESS === '1'
            ? raw
            : filterSuppressed(raw, sources)
    return { violations, timings, parseMs, walkMs }
}

function isCheck(value: unknown): value is Check {
    if (value === null || typeof value !== 'object') return false
    const candidate = value as { id?: unknown; visitors?: unknown }
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.visitors === 'object' &&
        candidate.visitors !== null
    )
}

export async function loadChecks(checksDirUrl: URL): Promise<Check[]> {
    const dirPath = fileURLToPath(checksDirUrl)
    if (!existsSync(dirPath)) return []

    const entries = await readdir(dirPath)
    const checkFiles = entries.filter(name => name.endsWith('.check.ts'))
    if (checkFiles.length === 0) return []

    const modules = await Promise.all(
        checkFiles.map(async file => {
            const href = new URL(file, checksDirUrl).href
            const mod = (await import(href)) as { default?: unknown }
            if (!isCheck(mod.default)) {
                throw new Error(
                    `guardrails: check file "${file}" must have a default export implementing the Check interface (id, visitors)`,
                )
            }
            return mod.default
        }),
    )
    return modules
}
