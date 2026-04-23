import ts from 'typescript'
import { forEachMakeStylesStyleObject, getLineCol } from '../utils/ast.js'
import type { Check, SourceMap, Violation } from '../types.js'

const RULE_ID = 'no-numeric-sizes'

const REMEDIATION =
    'Use theme.spacing.*, theme.borderRadius.*, or theme.borders.* from apps/mobile/src/theme/theme.ts.'

const SPACING_PROPS = new Set([
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'paddingHorizontal',
    'paddingVertical',
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'marginHorizontal',
    'marginVertical',
    'top',
    'right',
    'bottom',
    'left',
    'width',
    'height',
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight',
    'borderRadius',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomLeftRadius',
    'borderBottomRightRadius',
    'borderWidth',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'gap',
    'rowGap',
    'columnGap',
])

function getPropertyName(prop: ts.PropertyAssignment): string | null {
    const name = prop.name
    if (ts.isIdentifier(name)) return name.text
    if (ts.isStringLiteral(name)) return name.text
    return null
}

function describeLiteralValue(expr: ts.Expression): string | null {
    if (ts.isNumericLiteral(expr)) {
        if (expr.text === '0') return null
        return expr.text
    }
    if (
        ts.isPrefixUnaryExpression(expr) &&
        expr.operator === ts.SyntaxKind.MinusToken &&
        ts.isNumericLiteral(expr.operand)
    ) {
        return `-${expr.operand.text}`
    }
    return null
}

function collectFromSourceFile(sf: ts.SourceFile, out: Violation[]): void {
    forEachMakeStylesStyleObject(sf, styleEntry => {
        for (const prop of styleEntry.properties) {
            if (!ts.isPropertyAssignment(prop)) continue
            const name = getPropertyName(prop)
            if (name === null) continue
            if (!SPACING_PROPS.has(name)) continue
            const value = describeLiteralValue(prop.initializer)
            if (value === null) continue
            const { line, column } = getLineCol(
                sf,
                prop.initializer.getStart(sf),
            )
            out.push({
                file: sf.fileName,
                line,
                column,
                ruleId: RULE_ID,
                message: `numeric value ${value} for "${name}" — use a theme token`,
                remediation: REMEDIATION,
            })
        }
    })
}

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow literal numeric spacing/sizing values in makeStyles objects. Require theme tokens.',
    run(sources: SourceMap): Violation[] {
        const violations: Violation[] = []
        for (const sf of sources.values()) {
            collectFromSourceFile(sf, violations)
        }
        return violations
    },
}

export default check
