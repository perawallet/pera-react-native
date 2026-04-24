export interface ParsedArgs {
    json: boolean
    warnOnly: boolean
}

export function parseArgs(argv: string[]): ParsedArgs {
    const result: ParsedArgs = { json: false, warnOnly: false }
    for (const flag of argv) {
        if (flag === '--json') {
            result.json = true
            continue
        }
        if (flag === '--warn-only') {
            result.warnOnly = true
            continue
        }
        throw new Error(`guardrails: unknown flag "${flag}"`)
    }
    return result
}
