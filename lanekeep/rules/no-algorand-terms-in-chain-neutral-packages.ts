/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { ownText, referencesQuery } from '../shared/references.js'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

// A package joins once its chain half sits behind adapters. These three also
// keep their comments chain-free; the others explain adapter behaviour in
// prose, so only their names and literals are checked.
const PROSE_CHECKED_PACKAGES = ['backup', 'device', 'migrate']
const CODE_CHECKED_PACKAGES = [
    'accounts',
    'assets',
    'chain-shared',
    'connections',
    'signing',
    'swaps',
    'transactions',
]

// Word-bounded `Networks` so `useNetworks` stays legal; the rest match inside
// names (`rekeyed`, `onRekey`, `ARC59_APP_ID`, `AsbImport…`, `ALGORAND_…`).
const ALGORAND_TERMS =
    /\bNetworks\b|algorand|Algorand|ALGORAND|rekey|Rekey|REKEY|arc59|Arc59|ARC59|asb|Asb|ASB/

const CHAIN_TERMS = new RegExp(
    [
        ALGORAND_TERMS.source,
        'falcon|Falcon|FALCON',
        'algod|Algod|ALGOD',
        'algokit|Algokit|AlgoKit|ALGOKIT',
        'ed25519|Ed25519|ED25519',
        'peikert|Peikert|PEIKERT',
        'lsig|Lsig|LSig|LSIG',
        'secp256k1|Secp256k1|SECP256K1',
        'ethereum|Ethereum|ETHEREUM',
        '\\bevm|Evm|EVM',
    ].join('|'),
)

const PROSE_KINDS = new Set(['comment', 'jsx_text'])
const PROSE_CHECKED_PATH = new RegExp(
    `(^|/)packages/(${PROSE_CHECKED_PACKAGES.join('|')})/src/`,
)

type Allowed = {
    file: string
    reason: string
}

// Matched by path suffix.
const ALLOWED: readonly Allowed[] = [
    {
        file: 'packages/backup/src/cloud/crypto/wireFormat.ts',
        reason: 'Frozen backend wire formats: the backend verifies the register proof as an Algorand signBytes message and decodes the backup id as an Algorand address, whatever chains the backup holds.',
    },
]

export default defineRule({
    id: 'pera/no-algorand-terms-in-chain-neutral-packages',
    severity: 'error',
    card: {
        message: 'a chain-neutral package names a chain-specific concept',
        remediation:
            "Reach a chain through the package's chain adapter: put chain code in packages/chain-algorand or packages/chain-ethereum, or name the concept neutrally (delegation/authority for rekey, quantum or pq for falcon, node or network for algod). A value already persisted under the old word stays, suppressed with the reason. App feature modules such as apps/mobile/src/modules/rekey are outside the rule and keep their product's word.",
        examples: {
            bad: 'export class RekeyError extends AppError {}',
            good: 'export class DelegationError extends AppError {}',
        },
    },
    gates: withoutTests({
        pathMatches: [
            `**/packages/{${[...PROSE_CHECKED_PACKAGES, ...CODE_CHECKED_PACKAGES].join(',')}}/src/**`,
        ],
        pathNotMatches: [...TEST_SUPPORT],
    }),
    query: referencesQuery(CHAIN_TERMS),
    check(ctx, m) {
        const token = m.token
        if (token === undefined) return
        if (ALLOWED.some(entry => ctx.filePath.endsWith(entry.file))) return
        const isProse = PROSE_KINDS.has(ctx.kind(token))
        if (isProse && !PROSE_CHECKED_PATH.test(ctx.filePath)) return
        const hit = (isProse ? ALGORAND_TERMS : CHAIN_TERMS).exec(
            ownText(ctx, token),
        )
        if (hit === null) return
        ctx.report(
            token,
            `"${hit[0]}" is a chain-specific term in a chain-neutral package`,
        )
    },
})
