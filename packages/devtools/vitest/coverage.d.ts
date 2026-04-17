export declare const COVERAGE_THRESHOLD: number

export declare const coverageConfig: {
    provider: 'v8'
    all: boolean
    include: string[]
    exclude: string[]
    reporter: string[]
    reportsDirectory: string
    thresholds: {
        branches: number
        functions: number
        lines: number
        statements: number
    }
}
