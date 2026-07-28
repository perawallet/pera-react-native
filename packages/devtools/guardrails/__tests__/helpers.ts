import ts from 'typescript'
import { sharedWalk } from '../execute.js'
import type { Check, SourceMap, Violation } from '../types.js'

function scriptKindFor(filePath: string): ts.ScriptKind {
    return filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

/** Builds a single-file SourceMap from an in-memory string, for specs that don't need a fixture file on disk. */
export function buildSourceMap(filePath: string, source: string): SourceMap {
    const sf = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFor(filePath),
    )
    return new Map([[filePath, sf]])
}

/** Runs a single guardrail `check` against an in-memory source string and returns the violations it emits. */
export function runCheckOnSource(
    check: Check,
    filePath: string,
    source: string,
): Violation[] {
    const violations: Violation[] = []
    sharedWalk(buildSourceMap(filePath, source), [check], {}, violations)
    return violations
}
