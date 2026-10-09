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
            "Ask the account through the accessors in @perawallet/wallet-core-accounts (custodyOf, hasCustody, addressOn, chainAccountOf, signingKeyOn, hdIndexOf, hardwareDetailsOf, accountKindIdOf, localKeyKindOf), its presentation (useAccountPresentation, accountPresentationChainAdapters), or the chain adapter registry of the feature doing the work (deviceChainAdapters, multisigChainAdapters, backup's kindIdOf, …); render what a chain's LocalKeyKind declares instead of spelling a kind. The Algorand vocabulary lives in packages/chain-algorand/src/accounts.",
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
