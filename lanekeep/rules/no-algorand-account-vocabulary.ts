/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Node, RuleContext } from 'lanekeep'
import { defineRule } from 'lanekeep'
import { COMPOSITION_ROOTS } from '../shared/chain-package-allowlist.js'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

type Term = {
    name: string
    // Path fragments where the term is the owner's own word, not borrowed.
    ownedBy?: readonly RegExp[]
}

const KMS = /(^|\/)packages\/kms\/src\//
const EXTENSIONS = /(^|\/)extensions\/[^/]+\/src\//
const SHARED_UNITS = /(^|\/)packages\/shared\/src\//
const CHAIN_PACKAGE = /(^|\/)packages\/chain-[^/]+\/src\//
const MOBILE_BOOTSTRAP = /(^|\/)apps\/mobile\/src\/bootstrap\//
const FEATURE_OR_APP = /(^|\/)(packages|apps)\/[^/]+\/src\//

// Names only Algorand's account model has. The chain package owns them; shared
// code asks the accessors, the presentation or the feature's chain adapter.
// `hardwareDetails` and `multisigDetails` stay off the list because other
// models use those names (a hardware device's details, a multisig draft).
const VOCABULARY: readonly Term[] = [
    { name: 'AccountTypes' },
    { name: 'ACCOUNT_TYPE_RANK' },
    { name: 'DerivationTypes' },
    { name: 'DeviceAccountTypes' },
    { name: 'isStandaloneAccount' },
    { name: 'isQuantumAccount' },
    { name: 'isHDWalletAccount' },
    { name: 'isQuantumDowngrade' },
    { name: 'isAlgo25Account' },
    { name: 'canSignArc60' },
    { name: 'canSignViaParticipants' },
    { name: 'StandaloneAccount' },
    { name: 'QuantumAccount' },
    { name: 'HDWalletAccount' },
    { name: 'Algo25Account' },
    { name: 'hdWalletDetails' },
    { name: 'legacyDetails' },
    { name: 'toDeviceAccountType' },
    { name: 'resolveImportAccountType' },
    { name: 'buildStandaloneAccount' },
    { name: 'createStandaloneAccount' },
    { name: 'useHDWalletGroups' },
    { name: 'useFindQuantumAccountForMnemonic' },
    { name: 'useAccountInformationQuery' },
    { name: 'AccountSigTypes' },
    { name: 'useAccountSigTypeQuery' },
    { name: 'isRekeyedAccount' },
    { name: 'getRekeyAccount' },
    { name: 'useRekeyAccount' },
    { name: 'useAccountsRekeyedTo' },
    { name: 'useRekeyTransition' },
    { name: 'rekeyTransitionFor' },
    { name: 'RekeyTransition' },
    { name: 'rekeyAddress' },
    { name: 'rekeyAddressByNetwork' },
    { name: 'Peikert' },
    { name: 'Khovratovich' },
    // The keystore names its post-quantum binding after the algorithm; the
    // wallet calls it quantum.
    { name: 'falcon', ownedBy: [KMS, EXTENSIONS] },
    { name: 'Falcon', ownedBy: [KMS, EXTENSIONS] },
    // The canonical ALGO conversions live in the shared units module.
    { name: 'microAlgos', ownedBy: [SHARED_UNITS] },
]

const VOCABULARY_PATTERN = `^(${VOCABULARY.map(term => term.name).join('|')})$`
const VOCABULARY_NAMES = new Set(VOCABULARY.map(term => term.name))

// Word segments that name an Algorand account kind or state wherever they sit
// in a compound name (`useIsQuantumBlocked`, `ALGO25_SEED`, `RekeyedRow`).
// `PostQuantum` is the cryptographic family any chain may adopt. HD wallets and
// standalone keys are every chain's, and the bare `Rekey` verb names the
// transaction and its feature, so their exact names stay on the list above.
const COMPOUND_TOKENS = new Set(['quantum', 'algo25', 'rekeyed'])
const COMPOUND_CANDIDATE =
    '([Qq]uantum|QUANTUM|[Aa]lgo25|ALGO25|[Rr]ekeyed|REKEYED)'

// Shared code: every package other chains' features build on, and the app's
// cross-module hooks. An app feature module is its product's own UI (rekey to
// quantum, the legacy quantum notice) and answers to the exact names only. The
// keystore owns its seed schemes, and dev-fixtures builds one sample account
// per Algorand kind.
const SHARED_CODE =
    /(^|\/)(packages\/(?!chain-algorand\/|kms\/|dev-fixtures\/)[^/]+\/src|apps\/mobile\/src\/hooks)\//

type ProductName = { pattern: RegExp; reason: string }

// Product features the team names "quantum", matched against the whole name.
const PRODUCT_NAMES: readonly ProductName[] = [
    {
        pattern: /QuantumDapp/i,
        reason: 'the quantum dApp warning, a product feature behind its own remote-config flag',
    },
    {
        pattern: /QuantumSwap/i,
        reason: 'quantum swaps, a product feature behind its own remote-config flag',
    },
    {
        pattern: /^isQuantum(Enabled|Available)$/,
        reason: 'reads the platform `quantum` capability',
    },
    {
        pattern: /^quantumAccountSupportUrl$/,
        reason: "the quantum-account support article's configured URL",
    },
]

type AllowedNames = { file: string; names: readonly string[]; reason: string }

// Matched by path fragment and the exact name.
const ALLOWED: readonly AllowedNames[] = [
    {
        file: 'packages/accounts/src/',
        names: [
            'DiscoverRekeyedAccountsParams',
            'RekeyedSweepCandidate',
            'RekeyedSweepResult',
            'baseDiscoverRekeyedAccounts',
            'discoverRekeyedAccounts',
            'fetchRekeyedAddresses',
            'isRekeyedUnsignable',
            'rekeyed',
            'rekeyedAddress',
            'rekeyedAddresses',
            'rekeyedGlyph',
        ],
        reason: "the accounts discovery API and presentation field use Algorand's word for delegation; renaming them changes that package's public API",
    },
]

const segmentsOf = (name: string): string[] =>
    name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_$]+/)
        .filter(Boolean)
        .map(segment => segment.toLowerCase())

const hasCompoundToken = (name: string): boolean => {
    // An i18n key spelled as an object key.
    if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(name)) return false
    const segments = segmentsOf(name)
    return segments.some(
        (segment, i) =>
            COMPOUND_TOKENS.has(segment) &&
            !(segment === 'quantum' && segments[i - 1] === 'post'),
    )
}

const isAllowedCompound = (path: string, name: string): boolean =>
    PRODUCT_NAMES.some(product => product.pattern.test(name)) ||
    ALLOWED.some(
        entry => path.includes(entry.file) && entry.names.includes(name),
    )

// Bip39 is the root every chain derives from, so only the Algorand-only
// schemes count.
const ALGORAND_SEED_SCHEMES = ['Algo25', 'Quantum']

const ACCOUNT_KIND_LITERALS = ['quantum', 'hdWallet', 'algo25', 'standalone']

// A kind-named literal that isn't a kind: an icon, a test id or the platform's
// `quantum` capability.
const NON_KIND_KEYS = new Set([
    'platform',
    'icon',
    'leftIcon',
    'rightIcon',
    'name',
    'testID',
])

const isOwnedBy = (path: string, owners: readonly RegExp[]): boolean =>
    owners.some(owner => owner.test(path))

export default defineRule({
    id: 'pera/no-algorand-account-vocabulary',
    severity: 'error',
    card: {
        message: 'shared code names an Algorand account concept',
        remediation:
            "Name shared code after what it does, not the Algorand account kind it once served (`useIsDataSigningBlocked`, not `useIsQuantumDataSigningBlocked`). Ask the account through the accessors in @perawallet/wallet-core-accounts (custodyOf, hasCustody, addressOn, chainAccountOf, signingKeyOn, hdIndexOf, hardwareDetailsOf, accountKindIdOf, localKeyKindOf), its presentation (useAccountPresentation, accountPresentationChainAdapters), or the chain adapter registry of the feature doing the work (deviceChainAdapters, multisigChainAdapters, backup's kindIdOf, …); render the key-kind options the presentation registry offers (offeredLocalKeyKinds, keyKindOptionsOf) instead of spelling a kind. The Algorand vocabulary lives in packages/chain-algorand/src/accounts.",
        examples: {
            bad: "if (isQuantumAccount(account)) warn()\nif (custody.seed === 'quantum') warn()",
            good: 'const label = useAccountPresentation(account, chainId)?.labelKey',
        },
    },
    gates: productionSource({
        pathNotMatches: [
            ...TEST_SUPPORT,
            // The Algorand chain package owns its vocabulary; the contract and
            // the other chains must not borrow it.
            '**/packages/chain-algorand/src/**',
            // Composition roots register each chain.
            ...COMPOSITION_ROOTS.map(root => root.glob),
        ],
    }),
    query: [
        `([(identifier) (type_identifier) (property_identifier) (shorthand_property_identifier) (shorthand_property_identifier_pattern)] @name
            (#match? @name "${VOCABULARY_PATTERN}"))`,
        `([(identifier) (type_identifier) (property_identifier) (shorthand_property_identifier) (shorthand_property_identifier_pattern)] @compound
            (#match? @compound "${COMPOUND_CANDIDATE}"))`,
        `((member_expression
            object: (identifier) @seedObject
            property: (property_identifier) @seedMember) @seed
            (#eq? @seedObject "SeedScheme")
            (#any-of? @seedMember ${ALGORAND_SEED_SCHEMES.map(s => `"${s}"`).join(' ')}))`,
        `((string (string_fragment) @kind) @kindLiteral
            (#any-of? @kind ${ACCOUNT_KIND_LITERALS.map(k => `"${k}"`).join(' ')}))`,
    ].join('\n'),
    check(ctx, m) {
        const path = ctx.filePath

        if (m.name !== undefined) {
            const name = ctx.text(m.name)
            const term = VOCABULARY.find(t => t.name === name)
            if (term?.ownedBy && isOwnedBy(path, term.ownedBy)) return
            ctx.report(m.name, `"${name}" is Algorand vocabulary`)
            return
        }

        if (m.compound !== undefined) {
            const name = ctx.text(m.compound) ?? ''
            if (VOCABULARY_NAMES.has(name)) return
            if (!SHARED_CODE.test(path)) return
            if (!hasCompoundToken(name) || isAllowedCompound(path, name)) {
                return
            }
            if (isSeedSchemeMember(ctx, m.compound)) return
            ctx.report(
                m.compound,
                `"${name}" is Algorand account vocabulary in shared code`,
            )
            return
        }

        if (m.seed !== undefined) {
            if (isOwnedBy(path, [KMS, CHAIN_PACKAGE, MOBILE_BOOTSTRAP])) return
            if (!FEATURE_OR_APP.test(path)) return
            ctx.report(
                m.seed,
                `"${ctx.text(m.seed)}" picks an Algorand key scheme outside the chain package`,
            )
            return
        }

        const literal = m.kindLiteral
        if (literal === undefined) return
        if (isOwnedBy(path, [KMS, CHAIN_PACKAGE, MOBILE_BOOTSTRAP])) return
        if (isNonKindPosition(ctx, literal)) return
        ctx.report(
            literal,
            `${ctx.text(literal)} names an Algorand account kind`,
        )
    },
})

// `SeedScheme.Quantum` is the seed-scheme branch's to judge.
function isSeedSchemeMember(ctx: RuleContext, name: Node): boolean {
    const parent = ctx.parent(name)
    if (parent === undefined || ctx.kind(parent) !== 'member_expression') {
        return false
    }
    const [object] = ctx.namedChildren(parent)
    return (
        object !== undefined &&
        object !== name &&
        ctx.text(object) === 'SeedScheme'
    )
}

function isNonKindPosition(ctx: RuleContext, literal: Node): boolean {
    const parent = ctx.parent(literal)
    if (parent === undefined) return false
    const kind = ctx.kind(parent)

    if (kind === 'pair' || kind === 'jsx_attribute') {
        const key = ctx.namedChildren(parent)[0]
        return (
            key !== undefined &&
            key !== literal &&
            NON_KIND_KEYS.has(ctx.text(key) ?? '')
        )
    }
    if (kind === 'as_expression') {
        const type = ctx.namedChildren(parent)[1]
        return type !== undefined && ctx.text(type) === 'IconName'
    }
    return false
}
