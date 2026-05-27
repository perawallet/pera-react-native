import ts from 'typescript'
import { createMakeStylesEntryVisitor, getLineCol } from '../utils/ast.js'
import type { Check } from '../types.js'

const RULE_ID = 'no-empty-style-objects'

const REMEDIATION =
    'Remove the empty style key, or fill in real properties. An empty style entry produces no styles and only adds noise.'

function getKeyName(prop: ts.PropertyAssignment): string {
    const name = prop.name
    if (ts.isIdentifier(name)) return name.text
    if (ts.isStringLiteral(name)) return name.text
    return '<unknown>'
}

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow empty style entries inside makeStyles. An empty {} produces no styles.',
    visitors: {
        [ts.SyntaxKind.CallExpression]: createMakeStylesEntryVisitor(
            (styleEntry, sf, emit) => {
                if (styleEntry.properties.length > 0) return
                const parent = styleEntry.parent
                const keyName =
                    parent && ts.isPropertyAssignment(parent)
                        ? getKeyName(parent)
                        : '<unknown>'
                const { line, column } = getLineCol(sf, styleEntry.getStart(sf))
                emit({
                    line,
                    column,
                    message: `style entry "${keyName}" has an empty body`,
                    remediation: REMEDIATION,
                })
            },
        ),
    },
}

export default check
