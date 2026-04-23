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

export interface Check {
    id: string
    description: string
    run(sources: SourceMap): Violation[] | Promise<Violation[]>
}
