import ts from 'typescript'
import {
    descendMakeStylesCall,
    getLineCol,
    getMakeStylesBinding,
} from '../utils/ast.js'
import type { Check } from '../types.js'

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

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow direct typography properties in makeStyles objects. Require getTypography().',
    visitors: {
        [ts.SyntaxKind.CallExpression]: (node, sf, emit) => {
            const call = node as ts.CallExpression
            const binding = getMakeStylesBinding(sf)
            if (!binding) return
            if (
                !ts.isIdentifier(call.expression) ||
                call.expression.text !== binding
            )
                return
            descendMakeStylesCall(call, styleEntry => {
                for (const prop of styleEntry.properties) {
                    if (!ts.isPropertyAssignment(prop)) continue
                    const name = getPropertyName(prop)
                    if (name === null || !TYPOGRAPHY_PROPS.has(name)) continue
                    const { line, column } = getLineCol(sf, prop.getStart(sf))
                    emit({
                        line,
                        column,
                        message: `typography property "${name}" is not allowed inside makeStyles`,
                        remediation: REMEDIATION,
                    })
                }
            })
        },
    },
}

export default check
