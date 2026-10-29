/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Node, RuleContext } from 'lanekeep'
import { isRneuiMakeStyles } from './make-styles.js'

export const SIZE_CONSTANT_NAME = /^[A-Z][A-Z0-9_]*_(SIZE|HEIGHT|WIDTH)$/
export const TYPOGRAPHY_CONSTANT_NAME = /_(FONT_SIZE|LINE_HEIGHT)$/
export const JSX_SIZE_PROPS: ReadonlySet<string> = new Set([
    'width',
    'height',
    'size',
])

const TYPOGRAPHY_CALLS = new Set([
    'getTypography',
    'getFontWeightVariant',
    'moderateScale',
])
const TYPOGRAPHY_KEYS = new Set(['fontSize', 'lineHeight', 'letterSpacing'])
const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/'])
const TOKEN_READ =
    /^theme\s*\.\s*(spacing|borderRadius|borders)\s*(\.\s*[\w$]+|\[[^\]]+\])$/
const NEGATIVE_NUMBER = /^-\s*\d/

// The #match? is a cheap prefilter: only an expression that mentions a token
// crosses into `check`, where isTokenArithmetic decides.
export const TOKEN_ARITHMETIC_QUERY = String.raw`((binary_expression operator: _ @arithOp) @arith
  (#any-of? @arithOp "+" "-" "*" "/")
  (#match? @arith "theme\\s*\\.\\s*(spacing|borderRadius|borders)"))`

// jsx_attribute exists only in the tsx grammar.
export const JSX_NUMERIC_SIZE_PROP_QUERY = `(jsx_attribute
  (property_identifier) @jsxProp
  (jsx_expression [(number) (unary_expression)] @jsxValue)
  (#any-of? @jsxProp "width" "height" "size"))`

const SIZE_DECLARATOR = String.raw`(variable_declarator
    name: (identifier) @constName
    value: [(number) (unary_expression)] @constValue
    (#match? @constName "^[A-Z][A-Z0-9_]*_(SIZE|HEIGHT|WIDTH)$"))`

// `*_FONT_SIZE` and `*_LINE_HEIGHT` end in `_SIZE`/`_HEIGHT`, so this one query
// finds the typography constants too; each rule keeps the names it owns.
export const SIZE_CONSTANT_QUERY = `(program (lexical_declaration ${SIZE_DECLARATOR}))
(program (export_statement (lexical_declaration ${SIZE_DECLARATOR})))`

/** The text of a number, or of a unary minus over one; otherwise `undefined`. */
export function numericLiteral(
    ctx: RuleContext,
    node: Node,
): string | undefined {
    const kind = ctx.kind(node)
    const raw = ctx.text(node)
    if (raw === undefined) return undefined
    if (kind === 'number') return raw
    // `-8` parses as a unary minus over a number.
    if (kind === 'unary_expression' && NEGATIVE_NUMBER.test(raw)) return raw
    return undefined
}

interface Leaves {
    tokens: number
    pure: boolean
}

function scanLeaves(ctx: RuleContext, node: Node, acc: Leaves): void {
    if (!acc.pure) return
    const kind = ctx.kind(node)
    if (kind === 'number' || kind === 'comment') return

    if (kind === 'parenthesized_expression' || kind === 'unary_expression') {
        // `+`/`-` only; `!x`, `typeof x` and friends are not arithmetic.
        if (
            kind === 'unary_expression' &&
            !/^[-+]/.test(ctx.text(node) ?? '')
        ) {
            acc.pure = false
            return
        }
        for (const child of ctx.namedChildren(node)) {
            scanLeaves(ctx, child, acc)
        }
        return
    }

    if (kind === 'binary_expression') {
        if (!isArithmeticOperator(ctx, node)) {
            acc.pure = false
            return
        }
        for (const child of ctx.namedChildren(node)) {
            scanLeaves(ctx, child, acc)
        }
        return
    }

    if (kind === 'member_expression' || kind === 'subscript_expression') {
        if (TOKEN_READ.test(ctx.text(node) ?? '')) {
            acc.tokens += 1
            return
        }
    }
    acc.pure = false
}

function isArithmeticOperator(ctx: RuleContext, node: Node): boolean {
    const operator = ctx
        .children(node)
        .find(
            c => !ctx.isNamed(c) && ARITHMETIC_OPERATORS.has(ctx.kind(c) ?? ''),
        )
    return operator !== undefined
}

/**
 * A `+ - * /` expression whose leaves are all theme tokens or numeric
 * literals, with at least one token. An identifier or other member operand
 * (`insets.top`, `footerHeight`) makes it not token arithmetic.
 */
export function isTokenArithmetic(ctx: RuleContext, node: Node): boolean {
    if (ctx.kind(node) !== 'binary_expression') return false
    const acc: Leaves = { tokens: 0, pure: true }
    scanLeaves(ctx, node, acc)
    return acc.pure && acc.tokens > 0
}

/** Token arithmetic that is not itself an operand of a larger token expression. */
export function isOutermostTokenArithmetic(
    ctx: RuleContext,
    node: Node,
): boolean {
    if (!isTokenArithmetic(ctx, node)) return false
    let current = ctx.parent(node)
    while (
        current !== undefined &&
        (ctx.kind(current) === 'parenthesized_expression' ||
            ctx.kind(current) === 'unary_expression')
    ) {
        current = ctx.parent(current)
    }
    return current === undefined || !isTokenArithmetic(ctx, current)
}

export type ConstantSink = 'makeStyles' | 'jsxSizeProp' | 'typography'

const calleeName = (ctx: RuleContext, call: Node): string | undefined => {
    const callee = ctx.namedChildren(call)[0]
    if (callee === undefined || ctx.kind(callee) !== 'identifier') {
        return undefined
    }
    return ctx.text(callee)
}

// Every sink on the way up counts: `moderateScale` also scales sizes, so
// `width: moderateScale(ICON_SIZE)` must still reach the enclosing makeStyles.
function classify(
    ctx: RuleContext,
    reference: Node,
    sinks: Set<ConstantSink>,
): void {
    for (const ancestor of ctx.ancestors(reference)) {
        switch (ctx.kind(ancestor)) {
            case 'call_expression': {
                const name = calleeName(ctx, ancestor)
                if (name === undefined) break
                const callee = ctx.namedChildren(ancestor)[0]
                if (
                    name === 'makeStyles' &&
                    callee !== undefined &&
                    isRneuiMakeStyles(ctx, callee)
                ) {
                    sinks.add('makeStyles')
                } else if (TYPOGRAPHY_CALLS.has(name)) {
                    sinks.add('typography')
                }
                break
            }
            case 'jsx_attribute': {
                const attr = ctx.namedChildren(ancestor)[0]
                const name = attr === undefined ? undefined : ctx.text(attr)
                if (name !== undefined && JSX_SIZE_PROPS.has(name)) {
                    sinks.add('jsxSizeProp')
                }
                break
            }
            case 'pair': {
                const key = ctx.namedChildren(ancestor)[0]
                const name = key === undefined ? undefined : ctx.text(key)
                if (name !== undefined && TYPOGRAPHY_KEYS.has(name)) {
                    sinks.add('typography')
                }
                break
            }
        }
    }
}

/**
 * Where a module constant is read in its own file. The declaration itself is
 * skipped; every other identifier with the same name contributes each sink
 * that encloses it.
 */
export function constantSinks(
    ctx: RuleContext,
    constName: Node,
): ReadonlySet<ConstantSink> {
    const sinks = new Set<ConstantSink>()
    const name = ctx.text(constName)
    if (name === undefined) return sinks
    const root = ctx.ancestors(constName).at(-1)
    if (root === undefined) return sinks

    const line = ctx.line(constName)
    const column = ctx.column(constName)
    const references = ctx.querySubtree(
        root,
        `((identifier) @ref (#eq? @ref "${name}"))`,
    )
    for (const match of references) {
        const reference = match['ref']
        if (reference === undefined) continue
        if (ctx.line(reference) === line && ctx.column(reference) === column) {
            continue
        }
        classify(ctx, reference, sinks)
    }
    return sinks
}
