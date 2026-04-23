import ts from 'typescript'
import { forEachMakeStylesStyleObject, getLineCol } from '../utils/ast.js'
import type { Check, SourceMap, Violation } from '../types.js'

const RULE_ID = 'no-typography-in-styles'

const REMEDIATION =
    'Use getTypography(theme, variant) from @/theme/typography. Variants: h1..h4, body, caption, link, mono. Or use PWText with a variant prop from @components/core.'

const TYPOGRAPHY_PROPS = new Set([
    'fontSize',
    'fontFamily',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
])

function getPropertyName(prop: ts.PropertyAssignment): string | null {
    const name = prop.name
    if (ts.isIdentifier(name)) return name.text
    if (ts.isStringLiteral(name)) return name.text
    return null
}

function collectFromSourceFile(sf: ts.SourceFile, out: Violation[]): void {
    forEachMakeStylesStyleObject(sf, styleEntry => {
        for (const prop of styleEntry.properties) {
            if (!ts.isPropertyAssignment(prop)) continue
            const name = getPropertyName(prop)
            if (name === null) continue
            if (!TYPOGRAPHY_PROPS.has(name)) continue
            const { line, column } = getLineCol(sf, prop.getStart(sf))
            out.push({
                file: sf.fileName,
                line,
                column,
                ruleId: RULE_ID,
                message: `typography property "${name}" is not allowed inside makeStyles`,
                remediation: REMEDIATION,
            })
        }
    })
}

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow direct typography properties (fontSize, fontFamily, fontWeight, lineHeight, letterSpacing) in makeStyles objects. Require getTypography().',
    run(sources: SourceMap): Violation[] {
        const violations: Violation[] = []
        for (const sf of sources.values()) {
            collectFromSourceFile(sf, violations)
        }
        return violations
    },
}

export default check
