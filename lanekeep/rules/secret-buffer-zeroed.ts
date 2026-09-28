/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// Calls that return key material. The rule is blind to a producer missing
// here. Callback-style `pbkdf2` can't be listed (its key arrives as a callback
// parameter, which lanekeep doesn't track), so its promise wrappers are.
const PRODUCERS = [
    'algo25SecretKeyToIndices',
    'algo25SeedToIndices',
    'argon2id',
    'argon2idDerive',
    'backupMnemonicToPassword',
    'computeArgon2id',
    'decodePrivateKeyBytes',
    'deriveArgon2id',
    'deriveBackupAuthKeypair',
    'deriveBackupChildKeys',
    'deriveBackupKeys',
    'deriveBackupMasterKey',
    'deriveBip39Seed',
    'deriveLegacyPasskeyCredentialFromMainKey',
    'deriveLiquidAuthMainKey',
    'deriveMainKey',
    'derivePQKeygenSeed',
    'entropyToIndices',
    'fromSeed',
    'genDomainSpecificKeyPair',
    'generateHDMasterKey',
    'generateKeypairFromSeed',
    'hashPin',
    'hkdf',
    'indicesToAlgo25Seed',
    'indicesToEntropy',
    'indicesToUtf8Bytes',
    'mnemonicWordsToIndices',
    'prepareHDMasterKey',
    'requireSessionMasterKey',
    'unwrapMasterKeyWithPassword',
    // bip39/algosdk calls with no production caller, listed so a new one is checked.
    'mnemonicToEntropy',
    'mnemonicToSeed',
    'seedFromMnemonic',
]
const ACQUIRE = `^(${PRODUCERS.join('|')})$`
const WIPERS = '^(zeroBytes|wipeBytes)$'
// A field of a result counts only under one of these names: wiping or
// returning `keyPair.publicKey` leaves `keyPair.secretKey` behind. lanekeep
// tracks the result, not each field, so one secret field wiped or returned
// still discharges the others.
const SECRET_FIELDS =
    '^(authSecretKey|authSeed|encryptionKey|entropy|itemKey|masterKey|privateKey|rootKey|secretKey|seed)$'
const SECRET_FIELD = new RegExp(SECRET_FIELDS)

// lanekeep doesn't treat a throw as an exit, so only a wipe sitting directly
// in a finally block is known to run on every path.
const inFinally = (call: string, predicates: string) =>
    `((finally_clause (statement_block (expression_statement ${call} @release))) ${predicates})`

const fillZero = (object: string) =>
    `(call_expression function: (member_expression object: ${object} property: (property_identifier) @method) arguments: (arguments . (number) @zero .))`
const secretField = (object: string) =>
    `(member_expression object: ${object} property: (property_identifier) @field)`

const WIPES = [
    inFinally(fillZero('(_) @key'), '(#eq? @method "fill") (#eq? @zero "0")'),
    inFinally(
        '(call_expression function: (identifier) @fn arguments: (arguments (_) @key))',
        `(#match? @fn "${WIPERS}")`,
    ),
    inFinally(
        fillZero(secretField('(identifier) @key')),
        `(#eq? @method "fill") (#eq? @zero "0") (#match? @field "${SECRET_FIELDS}")`,
    ),
    inFinally(
        `(call_expression function: (identifier) @fn arguments: (arguments ${secretField('(identifier) @key')}))`,
        `(#match? @fn "${WIPERS}") (#match? @field "${SECRET_FIELDS}")`,
    ),
]

// Returning the buffer, or an object holding it, hands it to the caller.
// lanekeep doesn't resolve a shorthand `{ key }` to its binding, so a
// shorthand return is still reported.
const RETURNS = [
    '((return_statement (identifier) @key) @release)',
    '((return_statement (call_expression) @key) @release)',
    '((return_statement (await_expression (call_expression) @key)) @release)',
    '((return_statement (object (pair value: (identifier) @key))) @release)',
    `((return_statement (object (pair value: ${secretField('(identifier) @key')}))) @release (#match? @field "${SECRET_FIELDS}"))`,
    '((return_statement (object (pair value: (call_expression) @key))) @release)',
    '((return_statement (object (pair value: (await_expression (call_expression) @key)))) @release)',
    '((return_statement (call_expression function: (member_expression object: (call_expression) @key property: (property_identifier) @method))) @release (#eq? @method "finally"))',
    '((arrow_function body: (call_expression) @key @release))',
]

// `if (!key) return` leaves on the path where the producer returned nothing.
const NULL_GUARDS = [
    '((if_statement condition: (parenthesized_expression (unary_expression operator: "!" argument: (identifier) @key)) consequence: [(return_statement) (throw_statement)] @release))',
    '((if_statement condition: (parenthesized_expression (unary_expression operator: "!" argument: (identifier) @key)) consequence: (statement_block . [(return_statement) (throw_statement)] @release .)))',
]

export default defineRule({
    id: 'pera/secret-buffer-zeroed',
    severity: 'error',
    requires: ['dataflow'],
    card: {
        message: 'secret key material is not zeroed on every path',
        remediation:
            'Zero it in a finally block, with zeroBytes(buffer) from packages/kms/src/crypto/secure-memory.ts or buffer.fill(0), or return it so the caller owns it. A wipe outside finally is skipped when anything before it throws. If the buffer is handed to a long-lived owner (a store, a worker), suppress with the reason.',
        examples: {
            bad: 'const entropy = indicesToEntropy(indices)\nsign(entropy)\nentropy.fill(0)',
            good: 'const entropy = indicesToEntropy(indices)\ntry { return sign(entropy) } finally { entropy.fill(0) }',
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    // lanekeep gives every name destructured from a result the result's
    // identity, so a destructuring that binds no secret field (only
    // `publicKey`) would let the unbound secret leak unreported.
    query: `((variable_declarator name: (object_pattern) @pattern value: [(call_expression function: [(identifier) @fn (member_expression property: (property_identifier) @fn)]) (await_expression (call_expression function: [(identifier) @fn (member_expression property: (property_identifier) @fn)]))]) (#match? @fn "${ACQUIRE}"))`,
    check(ctx, match) {
        const bindsSecret = ctx.namedChildren(match.pattern!).some(entry => {
            const kind = ctx.kind(entry)
            if (kind === 'rest_pattern') return true
            const name =
                kind === 'pair_pattern' || kind === 'object_assignment_pattern'
                    ? ctx.namedChildren(entry)[0]
                    : entry
            return name !== undefined && SECRET_FIELD.test(ctx.text(name))
        })
        if (!bindsSecret) {
            ctx.report(
                match.pattern!,
                'the destructuring binds no secret field of the result, so the secret can never be zeroed',
            )
        }
    },
    obligation: {
        acquire: [
            `((call_expression function: (identifier) @fn) @acquire @key (#match? @fn "${ACQUIRE}"))`,
            `((call_expression function: (member_expression property: (property_identifier) @fn)) @acquire @key (#match? @fn "${ACQUIRE}"))`,
        ],
        release: [...WIPES, ...RETURNS, ...NULL_GUARDS],
        scope: 'function',
        // A release discharges only the buffer it zeroes or returns, not
        // every acquisition in the function.
        keyBy: 'binding',
    },
    checkObligation(ctx, unmet) {
        ctx.report(
            unmet.exit,
            unmet.partial
                ? 'the secret buffer is zeroed on some paths, not all'
                : 'the secret buffer is never zeroed in a finally block or returned',
        )
    },
})
