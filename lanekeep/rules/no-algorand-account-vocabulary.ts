/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { COMPOSITION_ROOTS } from '../shared/chain-package-allowlist.js'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// Names only Algorand's account model has. The chain package owns them; shared
// code asks the accessors, the chain's accounts adapter or its presentation.
// Matched as code identifiers only: a field read off the account (`.address`,
// `.hdWalletDetails`) is already a type error, and `hardwareDetails` and
// `multisigDetails` stay off the list because other models use those names
// (a hardware device's details, a multisig draft).
const VOCABULARY = [
    'AccountTypes',
    'ACCOUNT_TYPE_RANK',
    'DerivationTypes',
    'DeviceAccountTypes',
    'isAlgo25Account',
    'isQuantumAccount',
    'isHDWalletAccount',
    'isQuantumDowngrade',
    'canSignArc60',
    'canSignViaParticipants',
    'Algo25Account',
    'QuantumAccount',
    'HDWalletAccount',
    'hdWalletDetails',
    'Peikert',
    'Khovratovich',
]

const VOCABULARY_PATTERN = `^(${VOCABULARY.join('|')})$`

export default defineRule({
    id: 'pera/no-algorand-account-vocabulary',
    severity: 'error',
    card: {
        message: 'shared code names an Algorand account concept',
        remediation:
            "Ask the account through the accessors in @perawallet/wallet-core-accounts (custodyOf, hasCustody, addressOn, chainAccountOf, signingKeyOn, hdIndexOf, hardwareDetailsOf), the chain's AccountsChainAdapter (localKeyKinds, presentation, deviceAccountType) or useAccountPresentation. The Algorand vocabulary lives in packages/chain-algorand/src/accounts.",
        examples: {
            bad: 'if (isQuantumAccount(account)) warn()',
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
    query: `
        ([(identifier) (type_identifier) (shorthand_property_identifier_pattern)] @name
            (#match? @name "${VOCABULARY_PATTERN}"))
    `,
    check(ctx, m) {
        if (m.name === undefined) return
        ctx.report(
            m.name,
            `"${ctx.text(m.name)}" is Algorand account vocabulary`,
        )
    },
})
