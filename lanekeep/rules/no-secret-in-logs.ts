/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// The calls that turn a mnemonic into key material, and the fields that hold
// it. A new derivation or key field must be added here, or the rule is blind
// to it.
const SECRET_CALLS =
    '^(seedFromMnemonic|mnemonicToSeed|mnemonicToEntropy|derivePQKeygenSeed|resolveMnemonic|consumePendingImportMnemonic)$'
const SECRET_FIELDS = '^(privateKey|secretKey|mnemonic)$'

// A scanned or deep-linked URL can carry a mnemonic or a backup key, and a
// WalletConnect pairing URI carries the pairing secret in `key=`. These are
// the names such a value arrives under: the parse entry points of the link
// handlers, the scanner's `rawValue`, and the `uri` of a pairing request.
const LINK_FIELDS = '^(uri|sourceUrl|rawValue)$'
const LINK_PARAMETERS = '^uri$'
const LINK_CALLS = '^(getInitialURL|walletConnectUriOf)$'
const LINK_ENTRY_FUNCTIONS = '^(parseDeeplink|handleDeepLinkImpl)$'

// Helpers whose result is log-safe by construction. `pair` and
// `pairConnection` are here because a pairing outcome never echoes its URI;
// without them the URI argument taints `result.error` by containment.
const SANITIZERS =
    '^(redactSensitiveUrl|redactWalletConnectUri|walletConnectLogContext|walletConnectUriTopic|describeUri|describeV2PairingUri|originOf|pair|pairConnection)$'

const LOGGERS = '^(logger|console)$'

// Analytics and crash reports leave the device, so they are sinks like logs.
// `recordError` is crashlytics' modular API, which takes the instance first.
const BARE_REPORTERS = '^(trackEvent|trackScreen|recordError)$'
const REPORTER_OBJECTS =
    '^(Sentry|crashlytics|crashReporting|analyticsService|analytics)$'
const REPORTER_METHODS =
    '^(logEvent|captureException|captureMessage|recordError|recordNonFatalError|logBreadcrumb|log)$'

// `copyToClipboard` is `useClipboard`'s wrapper, and the engine doesn't follow
// a value into it.
const CLIPBOARD_CALLEE =
    /^(Clipboard\.setString(Async)?|navigator\.clipboard\.writeText|([\w$]+\.)?copyToClipboard)$/

// The engine can't seed a `catch` binding, so a caught error is recognised by
// its binding kind or by a parameter named like one (ky's `beforeError`).
const CAUGHT_ERROR_PARAMETER = /^(e|err|error|cause|reason)$|Error$/

const FUNCTION_LIKE = new Set([
    'arrow_function',
    'function_expression',
    'function_declaration',
    'method_definition',
    'generator_function',
    'generator_function_declaration',
])

const WRAPPERS = new Set([
    'as_expression',
    'satisfies_expression',
    'non_null_expression',
    'parenthesized_expression',
])

const isJsonStringify = (ctx: RuleContext, call: Node): boolean => {
    if (ctx.kind(call) !== 'call_expression') {
        return false
    }
    const callee = ctx.namedChildren(call)[0]
    return callee !== undefined && ctx.text(callee) === 'JSON.stringify'
}

function isSinkCall(ctx: RuleContext, node: Node): boolean {
    const kind = ctx.kind(node)
    if (kind === 'new_expression') {
        const ctor = ctx.namedChildren(node)[0]
        return (
            ctor !== undefined &&
            ctx.kind(ctor) === 'identifier' &&
            (ctx.text(ctor) ?? '').endsWith('Error')
        )
    }
    if (kind !== 'call_expression') {
        return false
    }
    const callee = ctx.namedChildren(node)[0]
    const text = callee === undefined ? undefined : ctx.text(callee)
    if (callee === undefined || text === undefined) {
        return false
    }
    if (CLIPBOARD_CALLEE.test(text)) {
        return true
    }
    if (ctx.kind(callee) === 'identifier') {
        return new RegExp(BARE_REPORTERS).test(text)
    }
    if (ctx.kind(callee) !== 'member_expression') {
        return false
    }
    const [object, property] = ctx.namedChildren(callee)
    if (
        object === undefined ||
        property === undefined ||
        ctx.kind(object) !== 'identifier'
    ) {
        return false
    }
    const objectText = ctx.text(object) ?? ''
    return (
        new RegExp(LOGGERS).test(objectText) ||
        (new RegExp(REPORTER_OBJECTS).test(objectText) &&
            new RegExp(REPORTER_METHODS).test(ctx.text(property) ?? ''))
    )
}

// The generic sinks (templates, `+`, `??`, `||`, `JSON.stringify`) match
// everywhere, so a finding counts only when the sink sits in the arguments of
// a log-like call. The walk stops at any other call's arguments, because a
// call is opaque to the engine, and at a function boundary.
function isInSinkArguments(ctx: RuleContext, node: Node): boolean {
    let previous = node
    for (const ancestor of ctx.ancestors(node)) {
        if (ancestor === node) {
            continue
        }
        const kind = ctx.kind(ancestor)
        if (kind !== undefined && FUNCTION_LIKE.has(kind)) {
            return false
        }
        if (ctx.kind(previous) === 'arguments') {
            if (isSinkCall(ctx, ancestor)) {
                return true
            }
            if (!isJsonStringify(ctx, ancestor)) {
                return false
            }
        }
        previous = ancestor
    }
    return false
}

function isCaughtError(ctx: RuleContext, value: Node): boolean {
    let current: Node | undefined = value
    while (current !== undefined) {
        const kind = ctx.kind(current)
        if (
            kind === 'member_expression' ||
            (kind !== undefined && WRAPPERS.has(kind))
        ) {
            current = ctx.namedChildren(current)[0]
        } else {
            break
        }
    }
    if (current === undefined || ctx.kind(current) !== 'identifier') {
        return false
    }
    const binding = ctx.bindingKind(current)
    return (
        binding === 'catch-param' ||
        (binding === 'param' &&
            CAUGHT_ERROR_PARAMETER.test(ctx.text(current) ?? ''))
    )
}

export default defineRule({
    id: 'pera/no-secret-in-logs',
    severity: 'error',
    requires: ['dataflow'],
    card: {
        message:
            'a secret reaches a log, analytics, crash-report, error or clipboard sink',
        remediation:
            'Log that the operation happened, never the value. Mnemonics, seeds and entropy, WalletConnect pairing URIs, scanned or deep-linked URLs and serialized errors must not reach a logger, the console, an analytics event, a crash report, an Error message or the clipboard. Log a classified value instead (the parsed link type, originOf(url), describeUri(uri)), and pass a caught error as { error }, never JSON.stringify(error).',
        examples: {
            bad: "logger.error('import failed', seed)",
            good: "logger.error('import failed')",
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    flow: {
        sources: [
            `((call_expression function: (identifier) @fn) @source (#match? @fn "${SECRET_CALLS}"))`,
            `((call_expression function: (member_expression property: (property_identifier) @fn)) @source (#match? @fn "${SECRET_CALLS}"))`,
            `((member_expression property: (property_identifier) @field) @source (#match? @field "${SECRET_FIELDS}"))`,
            `((member_expression property: (property_identifier) @field) @source (#match? @field "${LINK_FIELDS}"))`,
            `((required_parameter pattern: (identifier) @source) (#match? @source "${LINK_PARAMETERS}"))`,
            `((optional_parameter pattern: (identifier) @source) (#match? @source "${LINK_PARAMETERS}"))`,
            `((arrow_function parameter: (identifier) @source) (#match? @source "${LINK_PARAMETERS}"))`,
            `((call_expression function: [(identifier) @fn (member_expression property: (property_identifier) @fn)]) @source (#match? @fn "${LINK_CALLS}"))`,
            '((call_expression function: (member_expression object: (identifier) @object property: (property_identifier) @method) arguments: (arguments (string (string_fragment) @event) [(arrow_function parameter: (identifier) @source) (arrow_function parameters: (formal_parameters . (required_parameter pattern: (identifier) @source)))])) (#eq? @object "Linking") (#eq? @method "addEventListener") (#eq? @event "url"))',
            `((variable_declarator name: (identifier) @fn value: (arrow_function parameters: (formal_parameters . (required_parameter pattern: (identifier) @source)))) (#match? @fn "${LINK_ENTRY_FUNCTIONS}"))`,
        ],
        sinks: [
            `((call_expression function: (member_expression object: (identifier) @object) arguments: (arguments (_) @sink)) (#match? @object "${LOGGERS}"))`,
            `((call_expression function: (identifier) @fn arguments: (arguments (_) @sink)) (#match? @fn "${BARE_REPORTERS}"))`,
            `((call_expression function: (member_expression object: (identifier) @object property: (property_identifier) @method) arguments: (arguments (_) @sink)) (#match? @object "${REPORTER_OBJECTS}") (#match? @method "${REPORTER_METHODS}"))`,
            '((new_expression constructor: (identifier) @ctor arguments: (arguments (_) @sink)) (#match? @ctor "Error$"))',
            '(template_substitution (_) @sink)',
            '(binary_expression left: (_) @sink operator: ["+" "??" "||"])',
            '(binary_expression operator: ["+" "??" "||"] right: (_) @sink)',
            '((call_expression function: (member_expression object: (identifier) @json property: (property_identifier) @method) arguments: (arguments . (_) @sink)) (#eq? @json "JSON") (#eq? @method "stringify"))',
            '((call_expression function: (member_expression object: (identifier) @object property: (property_identifier) @method) arguments: (arguments . (_) @sink)) (#eq? @object "Clipboard") (#match? @method "^setString(Async)?$"))',
            '((call_expression function: (member_expression object: (member_expression object: (identifier) @navigator property: (property_identifier) @clipboard) property: (property_identifier) @method) arguments: (arguments . (_) @sink)) (#eq? @navigator "navigator") (#eq? @clipboard "clipboard") (#eq? @method "writeText"))',
            '((call_expression function: [(identifier) @fn (member_expression property: (property_identifier) @fn)] arguments: (arguments . (_) @sink)) (#eq? @fn "copyToClipboard"))',
        ],
        sanitizers: [
            `((call_expression function: [(identifier) @fn (member_expression property: (property_identifier) @fn)]) @sanitizer (#match? @fn "${SANITIZERS}"))`,
        ],
    },
    checkFlow(ctx, path) {
        if (isInSinkArguments(ctx, path.sink)) {
            ctx.report(path.sink, 'a secret reaches this sink')
        }
    },
    query: '((call_expression function: (member_expression object: (identifier) @json property: (property_identifier) @method) arguments: (arguments . (_) @value)) @stringify (#eq? @json "JSON") (#eq? @method "stringify"))',
    check(ctx, match) {
        const { value, stringify } = match
        if (value === undefined || stringify === undefined) {
            return
        }
        if (isCaughtError(ctx, value) && isInSinkArguments(ctx, stringify)) {
            ctx.report(
                value,
                'a caught error is serialized whole into this sink',
            )
        }
    },
})
