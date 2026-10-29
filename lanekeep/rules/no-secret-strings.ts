/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { FlowPath, Match, Node, RuleContext } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'
import { SCOPED_SECRET_HELPERS, SECRET_PRODUCERS } from '../shared/secrets.js'

type SinkClass = 'string' | 'state' | 'memo' | 'store' | 'scope'

const MESSAGES: Record<SinkClass, string> = {
    string: 'key material becomes a string here, which cannot be zeroed',
    state: 'key material is held in React state',
    memo: 'key material is held in a useMemo result',
    store: 'key material is written to a store',
    scope: 'key material leaves the scoped helper unmarked; pass it through handOffSecret to the owner that zeroes it',
}

const PRODUCER_NAMES = `^(${SECRET_PRODUCERS.join('|')})$`
const HELPER_NAMES = `^(${SCOPED_SECRET_HELPERS.join('|')})$`
// The repo's byte-to-string encoders. An encoder missing here is a blind spot.
const STRING_ENCODERS =
    '^(bytesToHex|toHex|encodeToBase64|toBase64|toBase64Url|bytesToBase64Url|entropyToMnemonic)$'
const STRING_ENCODING_PATTERN =
    '^(hex|base64|base64url|utf8|utf-8|ascii|latin1|binary|ucs2|ucs-2|utf16le|utf-16le)$'
const CONVERTING_METHODS_PATTERN = '^(join|toHex|toBase64)$'
const STRING_ENCODING = new RegExp(STRING_ENCODING_PATTERN)
const CONVERTING_METHODS = new RegExp(CONVERTING_METHODS_PATTERN)
const STRING_ENCODERS_RE = new RegExp(STRING_ENCODERS)
const HELPER_NAMES_RE = new RegExp(HELPER_NAMES)
const DECODER_NAME = /([Dd]ecoder|DECODER)$/
const COPY_CONSTRUCTORS = new Set([
    'Uint8Array',
    'Uint16Array',
    'Uint32Array',
    'Buffer',
])
const COPY_FROM_OBJECTS = new Set([...COPY_CONSTRUCTORS, 'Array'])
const COPY_CONSTRUCTOR_NAMES = [...COPY_CONSTRUCTORS].join('|')
const COPY_FROM_NAMES = [...COPY_FROM_OBJECTS].join('|')
const LENGTH_PROPERTIES = new Set([
    'length',
    'byteLength',
    'byteOffset',
    'size',
])
const WRAPPERS = new Set([
    'parenthesized_expression',
    'await_expression',
    'as_expression',
    'non_null_expression',
    'satisfies_expression',
])
const FUNCTION_KINDS = new Set([
    'arrow_function',
    'function_expression',
    'function',
    'function_declaration',
    'generator_function',
    'method_definition',
])
const SECRET_FIELD_NAMES =
    '^(password|mnemonic|seed|privateKey|secret|passphrase)$'

const CALLEE =
    '[(identifier) @fn (member_expression property: (property_identifier) @fn)]'
const returnedValue = [
    '((return_statement (_) @sink))',
    '((arrow_function body: [(identifier) (member_expression) (subscript_expression) (call_expression) (new_expression) (object) (array) (parenthesized_expression) (await_expression) (as_expression) (ternary_expression)] @sink))',
]

// A call is opaque to taint, so a sink must capture the argument or receiver
// itself. A scoped callback is reachable only when it is written inline: a
// named handler (`withSecret(id, parsePinRecord)`) is not seen.
const SOURCES = [
    `((call_expression function: (identifier) @fn) @source (#match? @fn "${PRODUCER_NAMES}"))`,
    `((call_expression function: (member_expression property: (property_identifier) @fn)) @source (#match? @fn "${PRODUCER_NAMES}"))`,
    `((call_expression function: ${CALLEE} arguments: (arguments (arrow_function parameter: (identifier) @source))) (#match? @fn "${HELPER_NAMES}"))`,
    `((call_expression function: ${CALLEE} arguments: (arguments (arrow_function parameters: (formal_parameters . (required_parameter (identifier) @source))))) (#match? @fn "${HELPER_NAMES}"))`,
]

const SINKS = [
    // string conversion
    '((call_expression function: (member_expression object: (_) @sink property: (property_identifier) @method)) (#eq? @method "toString"))',
    `((call_expression function: ${CALLEE} arguments: (arguments (_) @sink)) (#match? @fn "${STRING_ENCODERS}"))`,
    `((call_expression function: (member_expression object: (_) @sink property: (property_identifier) @method)) (#match? @method "${CONVERTING_METHODS_PATTERN}"))`,
    '((call_expression function: (member_expression object: (new_expression constructor: (identifier) @ctor) property: (property_identifier) @method) arguments: (arguments (_) @sink)) (#eq? @ctor "TextDecoder") (#eq? @method "decode"))',
    '((call_expression function: (member_expression object: (identifier) @object property: (property_identifier) @method) arguments: (arguments (_) @sink)) (#match? @object "([Dd]ecoder|DECODER)$") (#eq? @method "decode"))',
    '(template_substitution (_) @sink)',
    '((binary_expression left: (_) @sink operator: "+" right: [(string) (template_string)]))',
    '((binary_expression left: [(string) (template_string)] operator: "+" right: (_) @sink))',
    // long-lived holders
    '((call_expression function: [(identifier) @fn (member_expression property: (property_identifier) @fn)] arguments: (arguments . (_) @sink)) (#eq? @fn "useState"))',
    '((call_expression function: (identifier) @fn arguments: (arguments (_) @sink)) (#match? @fn "^set[A-Z]"))',
    '((call_expression function: (identifier) @fn arguments: (arguments (_) @sink)) (#eq? @fn "set"))',
    '((call_expression function: (member_expression property: (property_identifier) @fn) arguments: (arguments (_) @sink)) (#eq? @fn "setState"))',
    ...returnedValue,
    // copies, which a call would otherwise hide
    `((new_expression constructor: (identifier) @ctor arguments: (arguments . (_) @sink)) (#match? @ctor "^(${COPY_CONSTRUCTOR_NAMES})$"))`,
    `((call_expression function: (member_expression object: (identifier) @object property: (property_identifier) @method) arguments: (arguments . (_) @sink)) (#match? @object "^(${COPY_FROM_NAMES})$") (#eq? @method "from"))`,
    '((call_expression function: (member_expression object: (_) @sink property: (property_identifier) @method)) (#eq? @method "slice"))',
]

const interfaceFields = `((interface_declaration name: (type_identifier) @type body: (interface_body (property_signature name: (property_identifier) @field type: (type_annotation (_) @annotation)) @prop)) (#match? @type "(State|Store)$") (#match? @field "${SECRET_FIELD_NAMES}"))`
const aliasFields = (object: string) =>
    `((type_alias_declaration name: (type_identifier) @type value: ${object}) (#match? @type "(State|Store)$") (#match? @field "${SECRET_FIELD_NAMES}"))`
const objectFields =
    '(object_type (property_signature name: (property_identifier) @field type: (type_annotation (_) @annotation)) @prop)'
const FIELD_QUERIES = [
    interfaceFields,
    aliasFields(objectFields),
    aliasFields(`(intersection_type ${objectFields})`),
    aliasFields(`(intersection_type (intersection_type ${objectFields}))`),
]

const unwrap = (ctx: RuleContext, node: Node): Node => {
    let current = node
    while (WRAPPERS.has(ctx.kind(current) ?? '')) {
        const inner = ctx.namedChildren(current)[0]
        if (inner === undefined) break
        current = inner
    }
    return current
}

const calleeOf = (
    ctx: RuleContext,
    call: Node,
): { name: string; object?: Node; isMember: boolean } | undefined => {
    const callee = ctx.namedChildren(call)[0]
    if (callee === undefined) return undefined
    const kind = ctx.kind(callee)
    if (kind === 'identifier') {
        return { name: ctx.text(callee) ?? '', isMember: false }
    }
    if (kind === 'member_expression') {
        const [object, property] = ctx.namedChildren(callee)
        if (object === undefined || property === undefined) return undefined
        return { name: ctx.text(property) ?? '', object, isMember: true }
    }
    return undefined
}

const callOfArgument = (ctx: RuleContext, node: Node): Node | undefined => {
    const list = ctx.parent(node)
    if (list === undefined || ctx.kind(list) !== 'arguments') return undefined
    const call = ctx.parent(list)
    if (call === undefined) return undefined
    const kind = ctx.kind(call)
    return kind === 'call_expression' || kind === 'new_expression'
        ? call
        : undefined
}

/** What `node` is copied into, when it is the copied value of a copy form. */
const copyOf = (ctx: RuleContext, node: Node): Node | undefined => {
    const call = callOfArgument(ctx, node)
    if (
        call !== undefined &&
        ctx.namedChildren(ctx.parent(node)!)[0] === node
    ) {
        const callee = calleeOf(ctx, call)
        if (callee === undefined) return undefined
        if (
            ctx.kind(call) === 'new_expression' &&
            !callee.isMember &&
            COPY_CONSTRUCTORS.has(callee.name)
        ) {
            return call
        }
        if (
            ctx.kind(call) === 'call_expression' &&
            callee.isMember &&
            callee.name === 'from' &&
            callee.object !== undefined &&
            ctx.kind(callee.object) === 'identifier' &&
            COPY_FROM_OBJECTS.has(ctx.text(callee.object) ?? '')
        ) {
            return call
        }
        return undefined
    }
    const member = ctx.parent(node)
    if (member === undefined || ctx.kind(member) !== 'member_expression') {
        return undefined
    }
    const [object, property] = ctx.namedChildren(member)
    if (object !== node || ctx.text(property!) !== 'slice') return undefined
    const outer = ctx.parent(member)
    return outer !== undefined &&
        ctx.kind(outer) === 'call_expression' &&
        ctx.namedChildren(outer)[0] === member
        ? outer
        : undefined
}

const isCopyForm = (ctx: RuleContext, node: Node): boolean => {
    const callee =
        ctx.kind(node) === 'call_expression' ||
        ctx.kind(node) === 'new_expression'
            ? calleeOf(ctx, node)
            : undefined
    if (callee === undefined) return false
    if (ctx.kind(node) === 'new_expression') {
        return !callee.isMember && COPY_CONSTRUCTORS.has(callee.name)
    }
    if (!callee.isMember) return false
    if (callee.name === 'slice') return true
    return (
        callee.name === 'from' &&
        callee.object !== undefined &&
        ctx.kind(callee.object) === 'identifier' &&
        COPY_FROM_OBJECTS.has(ctx.text(callee.object) ?? '')
    )
}

/** Whether `node` is the receiver of a call that makes it a string. */
const isConvertedToString = (ctx: RuleContext, node: Node): boolean => {
    const member = ctx.parent(node)
    if (member === undefined || ctx.kind(member) !== 'member_expression') {
        return false
    }
    const [object, property] = ctx.namedChildren(member)
    const call = ctx.parent(member)
    if (
        object !== node ||
        property === undefined ||
        call === undefined ||
        ctx.kind(call) !== 'call_expression' ||
        ctx.namedChildren(call)[0] !== member
    ) {
        return false
    }
    const method = ctx.text(property) ?? ''
    if (CONVERTING_METHODS.test(method)) return true
    if (method !== 'toString') return false
    const arg = ctx.namedChildren(call)[1]
    const encoding = arg === undefined ? undefined : ctx.namedChildren(arg)[0]
    // A bare toString() is a string too: "1,2,3" for a Uint8Array, UTF-8 for a Buffer.
    if (encoding === undefined) return true
    return (
        ctx.kind(encoding) === 'string' &&
        STRING_ENCODING.test((ctx.text(encoding) ?? '').slice(1, -1))
    )
}

/** The `setX` of a `const [x, setX] = useState(…)` in this file. */
const stateSetterNames = (ctx: RuleContext): Set<string> => {
    const names = new Set<string>()
    const matches = ctx.querySubtree(
        ctx.root,
        '((variable_declarator name: (array_pattern (identifier) @setter .) value: (call_expression function: [(identifier) @hook (member_expression property: (property_identifier) @hook)])) (#eq? @hook "useState"))',
    )
    for (const m of matches) {
        if (m.setter !== undefined) names.add(ctx.text(m.setter) ?? '')
    }
    return names
}

const classifyArgument = (
    ctx: RuleContext,
    call: Node,
): SinkClass | 'copy' | undefined => {
    const callee = calleeOf(ctx, call)
    if (callee === undefined) return undefined
    if (ctx.kind(call) === 'new_expression') return 'copy'
    const { name, object, isMember } = callee
    if (STRING_ENCODERS_RE.test(name)) return 'string'
    if (name === 'decode' && isMember && object !== undefined) {
        const objectText = ctx.text(object) ?? ''
        if (
            ctx.kind(object) === 'new_expression' ||
            DECODER_NAME.test(objectText)
        ) {
            return 'string'
        }
    }
    if (name === 'useState') return 'state'
    if (!isMember && /^set[A-Z]/.test(name)) {
        return stateSetterNames(ctx).has(name) ? 'state' : undefined
    }
    if (!isMember && name === 'set') return 'store'
    if (isMember && name === 'setState') return 'store'
    return 'copy'
}

const classifySink = (
    ctx: RuleContext,
    sink: Node,
): { cls: SinkClass; held: Node } | undefined => {
    const parent = ctx.parent(sink)
    if (parent === undefined) return undefined
    const parentKind = ctx.kind(parent)
    if (
        parentKind === 'template_substitution' ||
        parentKind === 'binary_expression'
    ) {
        return { cls: 'string', held: sink }
    }
    const call = callOfArgument(ctx, sink)
    if (call !== undefined) {
        const cls = classifyArgument(ctx, call)
        if (cls !== undefined && cls !== 'copy') return { cls, held: sink }
    }

    let node = sink
    for (let next = copyOf(ctx, node); next !== undefined;) {
        node = next
        next = copyOf(ctx, node)
    }
    if (isConvertedToString(ctx, node)) return { cls: 'string', held: node }

    let position = node
    for (;;) {
        const above = ctx.parent(position)
        if (above === undefined) return undefined
        const kind = ctx.kind(above) ?? ''
        if (WRAPPERS.has(kind) || kind === 'object' || kind === 'array') {
            position = above
        } else if (kind === 'pair') {
            if (ctx.namedChildren(above).at(-1) !== position) return undefined
            position = above
        } else if (kind === 'ternary_expression') {
            if (ctx.namedChildren(above)[0] === position) return undefined
            position = above
        } else if (kind === 'return_statement') {
            break
        } else if (kind === 'arrow_function') {
            if (ctx.namedChildren(above).at(-1) !== position) return undefined
            break
        } else {
            return undefined
        }
    }

    const owner = ctx
        .ancestors(position)
        .find(a => FUNCTION_KINDS.has(ctx.kind(a) ?? ''))
    const holder = owner === undefined ? undefined : callOfArgument(ctx, owner)
    const callee = holder === undefined ? undefined : calleeOf(ctx, holder)
    if (callee === undefined) return undefined
    if (HELPER_NAMES_RE.test(callee.name)) {
        return { cls: 'scope', held: position }
    }
    if (callee.name === 'useMemo') return { cls: 'memo', held: position }
    if (callee.name === 'useState') return { cls: 'state', held: position }
    // The updater form `set(() => ({ seed }))` writes the store as surely as `set({ seed })`.
    if (!callee.isMember && callee.name === 'set') {
        return { cls: 'store', held: position }
    }
    if (callee.isMember && callee.name === 'setState') {
        return { cls: 'store', held: position }
    }
    if (
        !callee.isMember &&
        /^set[A-Z]/.test(callee.name) &&
        stateSetterNames(ctx).has(callee.name)
    ) {
        return { cls: 'state', held: position }
    }
    return undefined
}

const PUBLIC_MATERIAL = /publicKey/i

const isPublicMaterial = (ctx: RuleContext, sink: Node): boolean => {
    const kind = ctx.kind(sink)
    if (kind === 'identifier') return PUBLIC_MATERIAL.test(ctx.text(sink) ?? '')
    if (kind === 'member_expression') {
        const property = ctx.namedChildren(sink)[1]
        return (
            property !== undefined &&
            PUBLIC_MATERIAL.test(ctx.text(property) ?? '')
        )
    }
    return false
}

const isHeldSecret = (ctx: RuleContext, value: Node, source: Node): boolean => {
    const node = unwrap(ctx, value)
    const kind = ctx.kind(node)
    if (kind === 'identifier') return !isPublicMaterial(ctx, node)
    if (kind === 'subscript_expression') return true
    if (kind === 'member_expression') {
        if (isPublicMaterial(ctx, node)) return false
        const property = ctx.namedChildren(node)[1]
        return !LENGTH_PROPERTIES.has(
            property === undefined ? '' : (ctx.text(property) ?? ''),
        )
    }
    if (kind === 'ternary_expression') {
        return ctx
            .namedChildren(node)
            .slice(1)
            .some(arm => isHeldSecret(ctx, arm, source))
    }
    if (kind === 'call_expression' || kind === 'new_expression') {
        return isCopyForm(ctx, node) || node === source
    }
    if (kind === 'object') {
        return ctx.namedChildren(node).some(child => {
            const childKind = ctx.kind(child)
            if (childKind === 'shorthand_property_identifier') {
                return !PUBLIC_MATERIAL.test(ctx.text(child) ?? '')
            }
            if (childKind === 'spread_element') return true
            if (childKind !== 'pair') return false
            const pairValue = ctx.namedChildren(child).at(-1)
            return (
                pairValue !== undefined && isHeldSecret(ctx, pairValue, source)
            )
        })
    }
    if (kind === 'array') {
        return ctx
            .namedChildren(node)
            .some(element => isHeldSecret(ctx, element, source))
    }
    return false
}

const isParameterIdentifier = (ctx: RuleContext, node: Node): boolean => {
    if (ctx.kind(node) !== 'identifier') return false
    const parent = ctx.parent(node)
    if (parent === undefined) return false
    const kind = ctx.kind(parent)
    return (
        kind === 'required_parameter' ||
        (kind === 'arrow_function' && ctx.namedChildren(parent)[0] === node)
    )
}

/** A flow from a callback parameter is a leak only inside that callback. */
const isOutsideParamOwner = (
    ctx: RuleContext,
    source: Node,
    sink: Node,
): boolean => {
    if (!isParameterIdentifier(ctx, source)) return false
    const owner = ctx
        .ancestors(source)
        .find(a => ctx.kind(a) === 'arrow_function')
    return owner === undefined || !ctx.ancestors(sink).includes(owner)
}

const holdsStringSecret = (annotation: string): boolean => {
    const normalized = annotation.replace(/\s+/g, ' ').trim()
    const unwrapNullable = (type: string): string => {
        const match = /^(?:Nullable|Optional|Maybe)<(.*)>$/.exec(type.trim())
        return match === null ? type.trim() : unwrapNullable(match[1]!)
    }
    return unwrapNullable(normalized)
        .split('|')
        .some(member =>
            /^(readonly )?string(\[\])?$/.test(unwrapNullable(member)),
        )
}

export default defineRule({
    id: 'pera/no-secret-strings',
    severity: 'error',
    requires: ['dataflow'],
    card: {
        message:
            'key material becomes a string, or is held in React state, a memo or a store',
        remediation:
            'Keep the bytes or wordlist indices and convert only at render, or at the boundary that needs a string, inside the scoped helper (withSecret and the like). A buffer that leaves a scoped helper goes through handOffSecret(buffer) to the owner that zeroes it. Where a string is unavoidable (a third-party API that only takes one), suppress that one line with an ignore-next-line directive for this rule whose reason names the boundary. File-scope suppressions are refused.',
        examples: {
            bad: 'withSecret(id, bytes => bytesToHex(bytes))',
            good: 'withSecret(id, bytes => sign(bytes))',
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    query: FIELD_QUERIES.join('\n'),
    check(ctx: RuleContext, match: Match) {
        const { prop, field, type, annotation } = match
        if (
            prop === undefined ||
            field === undefined ||
            type === undefined ||
            annotation === undefined
        ) {
            return
        }
        if (!holdsStringSecret(ctx.text(annotation) ?? '')) return
        ctx.report(
            prop,
            `\`${ctx.text(field)}\` in \`${ctx.text(type)}\` holds a secret as a string, which cannot be zeroed; hold bytes or wordlist indices`,
        )
    },
    flow: { sources: SOURCES, sinks: SINKS },
    checkFlow(ctx: RuleContext, path: FlowPath) {
        if (isOutsideParamOwner(ctx, path.source, path.sink)) return
        if (isPublicMaterial(ctx, path.sink)) return
        const classified = classifySink(ctx, path.sink)
        if (classified === undefined) return
        const { cls, held } = classified
        if (cls !== 'string' && !isHeldSecret(ctx, held, path.source)) return
        ctx.report(path.sink, MESSAGES[cls])
    },
})
