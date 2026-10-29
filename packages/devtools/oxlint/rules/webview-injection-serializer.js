/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { mentionsTypeReference } from './type-reference.js'

const SERIALIZER_TAG = 'webViewScript'
const SERIALIZER_JOIN = 'joinWebViewScripts'
const BRAND = 'WebViewScript'
const INJECT_METHOD = 'injectJavaScript'
const INJECTION_PROPS = new Set([
    'injectedJavaScript',
    'injectedJavaScriptBeforeContentLoaded',
])
const MEMO_HOOK = 'useMemo'

const isInjectCall = callee =>
    (callee.type === 'Identifier' && callee.name === INJECT_METHOD) ||
    (callee.type === 'MemberExpression' &&
        (callee.computed
            ? callee.property.type === 'Literal' &&
              callee.property.value === INJECT_METHOD
            : callee.property.type === 'Identifier' &&
              callee.property.name === INJECT_METHOD))

const isIdentifierNamed = (node, name) =>
    node.type === 'Identifier' && node.name === name

const findVariable = (scope, name) => {
    for (let current = scope; current; current = current.upper) {
        const variable = current.set.get(name)
        if (variable) return variable
    }
    return undefined
}

const soleDefinition = variable =>
    variable?.defs.length === 1 ? variable.defs[0] : undefined

// Only a single `const x = <init>` binding is trusted: a parameter, a `let`
// or a destructured name can hold anything by the time it is injected.
const constInitializer = variable => {
    const definition = soleDefinition(variable)
    if (definition?.type !== 'Variable') return undefined
    if (definition.parent.kind !== 'const') return undefined
    if (definition.node.id.type !== 'Identifier') return undefined
    return definition.node.init ?? undefined
}

const CODE = 'code'
const QUOTE_STATES = new Map([
    ["'", 'single'],
    ['"', 'double'],
])
const LINE_TERMINATORS = new Set(['\n', '\r', ' ', ' '])
const WORD_CHAR = /[\w$]/
const WHITESPACE = /\s/
// A `/` after one of these starts a regex literal rather than dividing.
const REGEX_AFTER_PUNCTUATOR = new Set([...'(,=:[!&|?{};+-*%<>~^'])
const REGEX_AFTER_KEYWORD = new Set([
    'return',
    'typeof',
    'instanceof',
    'in',
    'of',
    'new',
    'delete',
    'void',
    'throw',
    'case',
    'do',
    'else',
    'yield',
    'await',
])
// Stands for a token that ends an operand (a literal, an interpolation).
const OPERAND = 'operand'

const startsRegex = previous =>
    previous === undefined ||
    REGEX_AFTER_PUNCTUATOR.has(previous) ||
    REGEX_AFTER_KEYWORD.has(previous)

/**
 * Whether each hole between `parts` sits in plain code of the script they
 * spell out, rather than inside a string, template, regex or comment. The
 * encoder leaves `"` and `*\/` alone, so only a bare hole is safe.
 */
const holesInPlainCode = parts => {
    let state = CODE
    let previous
    let word = ''
    // One brace depth per `${` substitution open in a static template literal.
    const substitutions = []
    const holes = []

    const scanCode = (char, next) => {
        if (WORD_CHAR.test(char)) {
            word += char
            previous = word
            return 0
        }
        word = ''
        if (WHITESPACE.test(char)) return 0
        if (QUOTE_STATES.has(char)) {
            state = QUOTE_STATES.get(char)
            return 0
        }
        if (char === '`') {
            state = 'template'
            return 0
        }
        if (char === '/' && next === '/') {
            state = 'line'
            return 1
        }
        if (char === '/' && next === '*') {
            state = 'block'
            return 1
        }
        if (char === '/' && startsRegex(previous)) {
            state = 'regex'
            return 0
        }
        if (substitutions.length > 0 && char === '{') {
            substitutions[substitutions.length - 1]++
        } else if (substitutions.length > 0 && char === '}') {
            if (substitutions.at(-1) === 0) {
                substitutions.pop()
                state = 'template'
                return 0
            }
            substitutions[substitutions.length - 1]--
        }
        previous = char
        return 0
    }

    const endOperand = () => {
        state = CODE
        previous = OPERAND
        return 0
    }

    const scanString = char => {
        if (char === '\\') return 1
        if (QUOTE_STATES.get(char) === state) return endOperand()
        return 0
    }

    // Each scanner returns how many extra characters it consumed.
    const scanners = {
        [CODE]: scanCode,
        single: scanString,
        double: scanString,
        template: (char, next) => {
            if (char === '\\') return 1
            if (char === '`') return endOperand()
            if (char === '$' && next === '{') {
                substitutions.push(0)
                state = CODE
                previous = '{'
                return 1
            }
            return 0
        },
        line: char => {
            if (LINE_TERMINATORS.has(char)) state = CODE
            return 0
        },
        block: (char, next) => {
            if (char !== '*' || next !== '/') return 0
            state = CODE
            return 1
        },
        regex: char => {
            if (char === '\\') return 1
            if (char === '[') state = 'regexClass'
            if (char === '/') return endOperand()
            return 0
        },
        regexClass: char => {
            if (char === '\\') return 1
            if (char === ']') state = 'regex'
            return 0
        },
    }

    parts.forEach((part, partIndex) => {
        for (let i = 0; i < part.length; i++) {
            i += scanners[state](part[i], part[i + 1])
        }
        if (partIndex === parts.length - 1) return
        holes.push(state === CODE)
        if (state === CODE) {
            word = ''
            previous = OPERAND
        }
    })
    return holes
}

export const webviewInjectionSerializer = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Build every script injected into a WebView with the webViewScript serializer',
        },
        messages: {
            unserialized:
                "{{sink}} gets a script not built by the webViewScript tag or joinWebViewScripts(): injected source runs with the page's privileges, so data may enter it only as an encoded interpolation. Build it with webViewScript from @modules/webview, or bind a fixed script to a const.",
            cast: "Casting to WebViewScript skips the serializer's encoding: build the script with the webViewScript tag.",
            outsideCode:
                'A webViewScript interpolation is already an encoded JS expression, so it must sit in plain code. Inside a string, template, regex or comment the payload becomes part of that literal, and a double quote or */ in it can break out. Write ${value} bare, outside any quote or comment.',
        },
        schema: [],
    },
    create(context) {
        const { sourceCode } = context
        const resolving = new Set()

        const resolve = identifier =>
            findVariable(sourceCode.getScope(identifier), identifier.name)

        const isReactImport = identifier => {
            const definition = soleDefinition(resolve(identifier))
            return (
                definition?.type === 'ImportBinding' &&
                definition.parent.source.value === 'react'
            )
        }

        const isMemoHook = callee =>
            (callee.type === 'Identifier' &&
                callee.name === MEMO_HOOK &&
                isReactImport(callee)) ||
            (callee.type === 'MemberExpression' &&
                !callee.computed &&
                isIdentifierNamed(callee.property, MEMO_HOOK) &&
                callee.object.type === 'Identifier' &&
                isReactImport(callee.object))

        // A memo is as safe as the value its factory returns.
        const isSanctionedMemo = node => {
            if (!isMemoHook(node.callee)) return false
            const [factory] = node.arguments
            return (
                factory?.type === 'ArrowFunctionExpression' &&
                factory.body.type !== 'BlockStatement' &&
                isSanctioned(factory.body)
            )
        }

        // A const is only as safe as its initializer: a fixed script is fine,
        // a template splicing config into one is not.
        const isSanctionedBinding = identifier => {
            const variable = resolve(identifier)
            if (!variable || variable.defs.length === 0) {
                return identifier.name === 'undefined'
            }
            const init = constInitializer(variable)
            if (!init || resolving.has(variable)) return false
            resolving.add(variable)
            try {
                return isSanctioned(init)
            } finally {
                resolving.delete(variable)
            }
        }

        const isSanctioned = node => {
            if (node.type === 'Literal') return typeof node.value === 'string'
            if (node.type === 'TemplateLiteral') {
                return node.expressions.length === 0
            }
            if (node.type === 'TaggedTemplateExpression') {
                return isIdentifierNamed(node.tag, SERIALIZER_TAG)
            }
            if (node.type === 'CallExpression') {
                return (
                    isIdentifierNamed(node.callee, SERIALIZER_JOIN) ||
                    isSanctionedMemo(node)
                )
            }
            if (node.type === 'Identifier') return isSanctionedBinding(node)
            if (node.type === 'ConditionalExpression') {
                return (
                    isSanctioned(node.consequent) &&
                    isSanctioned(node.alternate)
                )
            }
            return false
        }

        const report = (node, sink) =>
            context.report({ node, messageId: 'unserialized', data: { sink } })

        const checkCast = node => {
            if (mentionsTypeReference(node.typeAnnotation, BRAND)) {
                context.report({ node, messageId: 'cast' })
            }
        }

        return {
            CallExpression(node) {
                if (!isInjectCall(node.callee)) return
                const [script] = node.arguments
                if (script && isSanctioned(script)) return
                report(node, `${INJECT_METHOD}()`)
            },
            JSXAttribute(node) {
                if (
                    node.name.type !== 'JSXIdentifier' ||
                    !INJECTION_PROPS.has(node.name.name)
                ) {
                    return
                }
                const { value } = node
                if (value?.type === 'Literal') return
                if (
                    value?.type === 'JSXExpressionContainer' &&
                    isSanctioned(value.expression)
                ) {
                    return
                }
                report(node, node.name.name)
            },
            TaggedTemplateExpression(node) {
                if (!isIdentifierNamed(node.tag, SERIALIZER_TAG)) return
                const { quasis, expressions } = node.quasi
                // Cooked, because that is the text the serializer emits.
                const parts = quasis.map(
                    quasi => quasi.value.cooked ?? quasi.value.raw,
                )
                holesInPlainCode(parts).forEach((isInCode, index) => {
                    if (isInCode) return
                    context.report({
                        node: expressions[index],
                        messageId: 'outsideCode',
                    })
                })
            },
            TSAsExpression: checkCast,
            TSTypeAssertion: checkCast,
        }
    },
}
