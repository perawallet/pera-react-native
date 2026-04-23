import ts from 'typescript'
import { performance } from 'node:perf_hooks'
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
