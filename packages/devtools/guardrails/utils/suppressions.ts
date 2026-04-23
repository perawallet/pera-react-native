import ts from 'typescript'
import type { SourceMap, Violation } from '../types.js'

const FILE_DIRECTIVE = 'guardrails-ignore-file'
const LINE_DIRECTIVE = 'guardrails-ignore-next-line'

function parseRuleIds(raw: string): string[] {
    return raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
}

function extractDirectiveRules(
    commentText: string,
    directive: string,
): string[] {
    const idx = commentText.indexOf(directive)
    if (idx === -1) return []
    const after = commentText.slice(idx + directive.length)
    return parseRuleIds(after)
}

function collectFileSuppressions(sf: ts.SourceFile): Set<string> {
    const result = new Set<string>()
    const fullText = sf.getFullText()
    const firstNode = sf.statements[0]
    const scanEnd = firstNode ? firstNode.getFullStart() : fullText.length
    const ranges = ts.getLeadingCommentRanges(fullText, 0) ?? []
    for (const range of ranges) {
        if (range.end > scanEnd) continue
        const text = fullText.slice(range.pos, range.end)
        for (const ruleId of extractDirectiveRules(text, FILE_DIRECTIVE)) {
            result.add(ruleId)
        }
    }
    return result
}

function findPrecedingNonBlankLine(
    lines: string[],
    zeroBasedViolationLine: number,
): string | null {
    for (let i = zeroBasedViolationLine - 1; i >= 0; i -= 1) {
        const line = lines[i]
        if (line !== undefined && line.trim().length > 0) {
            return line
        }
    }
    return null
}

export function filterSuppressed(
    violations: Violation[],
    sources: SourceMap,
): Violation[] {
    const fileSuppressionsByPath = new Map<string, Set<string>>()
    const linesByPath = new Map<string, string[]>()

    for (const [path, sf] of sources) {
        fileSuppressionsByPath.set(path, collectFileSuppressions(sf))
        linesByPath.set(path, sf.getFullText().split('\n'))
    }

    return violations.filter((violation) => {
        const fileSuppressions = fileSuppressionsByPath.get(violation.file)
        if (fileSuppressions && fileSuppressions.has(violation.ruleId)) {
            return false
        }

        const lines = linesByPath.get(violation.file)
        if (!lines) return true

        const preceding = findPrecedingNonBlankLine(lines, violation.line - 1)
        if (preceding === null) return true

        const lineRules = extractDirectiveRules(preceding, LINE_DIRECTIVE)
        if (lineRules.includes(violation.ruleId)) {
            return false
        }
        return true
    })
}
