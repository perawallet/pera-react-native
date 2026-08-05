import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import { isStringLeaf, loadEnFlat } from '../utils/locale.js'
import type { Check } from '../types.js'

const RULE_ID = 'error-params-match-copy'

const REMEDIATION =
    'Add a params entry for every {{placeholder}} in the copy, or remove the placeholder. Extra params without a placeholder are fine — they serve as log context.'

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g

function getPlaceholders(copy: string): string[] {
    return [...copy.matchAll(PLACEHOLDER_RE)].map(([, name]) => name)
}

function propName(prop: ts.ObjectLiteralElementLike): string | null {
    const name = prop.name
    if (name === undefined) return null
    if (ts.isIdentifier(name)) return name.text
    if (ts.isStringLiteral(name)) return name.text
    return null
}

/**
 * `null` means "present but not statically readable" — reported as
 * unverifiable. An empty array means "no params declared".
 */
function readParamNames(
    container: ts.ObjectLiteralExpression,
): string[] | null {
    // `{ params }` shorthand has no initializer to read — unverifiable, not
    // "no params declared".
    const hasParamsShorthand = container.properties.some(
        p => ts.isShorthandPropertyAssignment(p) && propName(p) === 'params',
    )
    if (hasParamsShorthand) return null

    const paramsProp = container.properties.find(
        p => ts.isPropertyAssignment(p) && propName(p) === 'params',
    )
    if (paramsProp === undefined) {
        // A spread on the container itself (e.g. `{ ...base, messageKey }`)
        // could supply `params` at runtime even though no `params` property
        // is written here — unverifiable, not "no params declared".
        const hasContainerSpread = container.properties.some(p =>
            ts.isSpreadAssignment(p),
        )
        return hasContainerSpread ? null : []
    }
    if (!ts.isPropertyAssignment(paramsProp)) return null
    const init = paramsProp.initializer
    if (init.kind === ts.SyntaxKind.UndefinedKeyword) return []
    if (!ts.isObjectLiteralExpression(init)) return null
    if (init.properties.some(p => ts.isSpreadAssignment(p))) return null
    const names = init.properties.map(propName)
    if (names.some(n => n === null)) return null
    return names as string[]
}

const check: Check = {
    id: RULE_ID,
    description:
        'Every {{placeholder}} in an error messageKey copy must have a matching params entry.',
    visitors: {
        [ts.SyntaxKind.PropertyAssignment]: (node, sf, emit) => {
            if (!ts.isPropertyAssignment(node)) return
            if (propName(node) !== 'messageKey') return
            if (!ts.isStringLiteral(node.initializer)) return

            const flat = loadEnFlat()
            // Missing key is error-message-key-exists' job, not ours.
            if (!isStringLeaf(flat, node.initializer.text)) return

            const placeholders = getPlaceholders(flat[node.initializer.text])
            if (placeholders.length === 0) return

            const container = node.parent
            if (!ts.isObjectLiteralExpression(container)) return

            const { line, column } = getLineCol(sf, node.getStart(sf))
            const params = readParamNames(container)

            if (params === null) {
                emit({
                    line,
                    column,
                    message: `params for "${node.initializer.text}" are unverifiable (not a plain object literal); placeholders ${placeholders.join(', ')} cannot be checked`,
                    remediation: REMEDIATION,
                })
                return
            }

            const missing = placeholders.filter(p => !params.includes(p))
            if (missing.length === 0) return

            emit({
                line,
                column,
                message: `copy for "${node.initializer.text}" interpolates ${missing.join(', ')} but params does not provide it`,
                remediation: REMEDIATION,
            })
        },
    },
}

export default check
