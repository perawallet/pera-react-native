import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import { loadEnFlat, isStringLeaf } from '../utils/locale.js'
import type { Check } from '../types.js'

const RULE_ID = 'error-message-key-exists'

const REMEDIATION =
    'Point messageKey at an existing string in apps/mobile/src/i18n/locales/en.json, or add the copy. A key naming an object will not render.'

/** The string literal assigned to a `messageKey` property, if any. */
function getMessageKeyLiteral(node: ts.Node): ts.StringLiteral | null {
    if (!ts.isPropertyAssignment(node)) return null
    const name = node.name
    const propName = ts.isIdentifier(name)
        ? name.text
        : ts.isStringLiteral(name)
          ? name.text
          : null
    if (propName !== 'messageKey') return null
    // A non-literal value can't be resolved statically; the runtime
    // missingKeyHandler covers those.
    if (!ts.isStringLiteral(node.initializer)) return null
    return node.initializer
}

// This rule is not total. It cannot see:
// - `{ messageKey }` shorthand (a ShorthandPropertyAssignment has no
//   initializer to read, so getMessageKeyLiteral never matches it)
// - non-string-literal values: variables, template literals, conditionals
// - extensions/** — discoverFilePaths only globs apps/mobile/src/** and
//   packages/*/src/**, so error classes living under extensions/ are unscanned

const check: Check = {
    id: RULE_ID,
    description:
        'Every error messageKey must resolve to a string leaf in en.json.',
    visitors: {
        [ts.SyntaxKind.PropertyAssignment]: (node, sf, emit) => {
            const literal = getMessageKeyLiteral(node)
            if (literal === null) return
            if (isStringLeaf(loadEnFlat(), literal.text)) return
            const { line, column } = getLineCol(sf, literal.getStart(sf))
            emit({
                line,
                column,
                message: `messageKey "${literal.text}" does not resolve to a string in en.json`,
                remediation: REMEDIATION,
            })
        },
    },
}

export default check
