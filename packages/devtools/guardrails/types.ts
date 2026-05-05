import type ts from 'typescript'

export type SourceMap = Map<string, ts.SourceFile>

export interface Violation {
    file: string
    line: number
    column: number
    ruleId: string
    message: string
    remediation: string
}

export type EmitViolation = (
    violation: Omit<Violation, 'ruleId' | 'file'>,
) => void

export type CheckVisitor = (
    node: ts.Node,
    sf: ts.SourceFile,
    emit: EmitViolation,
) => void

export type EmitFinalizeViolation = (
    violation: Omit<Violation, 'ruleId'>,
) => void

export interface FinalizeContext {
    sources: SourceMap
    emit: EmitFinalizeViolation
}

export type CheckFinalize = (ctx: FinalizeContext) => void

export interface Check {
    id: string
    description: string
    visitors: Partial<Record<ts.SyntaxKind, CheckVisitor>>
    finalize?: CheckFinalize
}
