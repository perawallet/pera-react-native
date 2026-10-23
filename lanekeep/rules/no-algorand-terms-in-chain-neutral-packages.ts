/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { ownText, referencesQuery } from '../shared/references.js'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

// A package joins once its Algorand half sits behind adapters.
const CHAIN_NEUTRAL_PACKAGES = ['backup', 'device', 'migrate']

// Word-bounded `Networks` so `useNetworks` stays legal; the rest match inside
// names (`rekeyed`, `onRekey`, `ARC59_APP_ID`, `AsbImport…`, `ALGORAND_…`).
const TERMS =
    /\bNetworks\b|algorand|Algorand|ALGORAND|rekey|Rekey|REKEY|arc59|Arc59|ARC59|asb|Asb|ASB/

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
        message: 'a chain-neutral package names an Algorand concept',
        remediation:
            "backup, device and migrate reach Algorand only through their chain adapters (BackupChainAdapter, DeviceChainAdapter, MigrationChainAdapter) and chain-contract's legacy helpers (LEGACY_CHAIN_ID, LEGACY_CHAIN_FAMILY). Put the Algorand-specific code in packages/chain-algorand and call it through the adapter, or name the concept neutrally (secure-backup, delegation).",
        examples: {
            bad: 'const prefix = ALGORAND_SIGN_PREFIX',
            good: 'const prefix = BACKUP_PROOF_PREFIX',
        },
    },
    gates: withoutTests({
        pathMatches: [
            `**/packages/{${CHAIN_NEUTRAL_PACKAGES.join(',')}}/src/**`,
        ],
        pathNotMatches: [...TEST_SUPPORT],
    }),
    query: referencesQuery(TERMS),
    check(ctx, m) {
        const token = m.token
        if (token === undefined) return
        if (ALLOWED.some(entry => ctx.filePath.endsWith(entry.file))) return
        const hit = TERMS.exec(ownText(ctx, token))
        if (hit === null) return
        ctx.report(
            token,
            `"${hit[0]}" is an Algorand term in a chain-neutral package`,
        )
    },
})
