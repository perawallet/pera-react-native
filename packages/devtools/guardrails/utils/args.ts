export interface ParsedArgs {
    json: boolean
}

export function parseArgs(argv: string[]): ParsedArgs {
    const result: ParsedArgs = { json: false }
    for (const flag of argv) {
        if (flag === '--json') {
            result.json = true
            continue
        }
        throw new Error('unknown flag: ' + flag)
    }
    return result
}
