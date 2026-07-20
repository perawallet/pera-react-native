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

import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    LegacyAccount,
    LegacyHDWallet,
    LegacyUndecodableAccount,
} from '@perawallet/wallet-extension-platform'
import {
    addKeylessAccountToStore,
    applyAllLegacyMetadata,
    applyLegacyAccountOrder,
    applyRekeyAddressToStoreAccount,
    markLegacyBackedUpAccounts,
    removeAccountFromStore,
} from './accountStoreOps'
import {
    classifyLegacyAccountRoute,
    isKeylessLegacyAccount,
    migrateLegacyAccount,
} from './migrateLegacyAccount'
import type {
    ImportedHdRoot,
    MigratedAccountPair,
    MigrationDeps,
    MigrationResult,
} from './types'

export type RunMigrationLoopArgs = MigrationDeps & {
    accounts: LegacyAccount[]
    hdWallets: LegacyHDWallet[]
    undecodableAccounts?: LegacyUndecodableAccount[]
    /**
     * True when the accounts step is re-running for an already-migrated user
     * (recorded accounts version >= 1). On a re-run the legacy Pera 6 ordering
     * must NOT be re-applied — doing so would wipe any reordering the user made
     * post-migration. First runs (undefined/false) still apply it.
     */
    isRerun?: boolean
}

export const runMigrationLoop = async (
    args: RunMigrationLoopArgs,
): Promise<MigrationResult> => {
    const summary: MigrationResult = { imported: 0, skipped: 0, failed: [] }
    const existingAddresses = new Set(
        useAccountsStore.getState().accounts.map(a => a.address),
    )
    const hdWalletsById = new Map(args.hdWallets.map(w => [w.walletId, w]))
    const importedHdRoots = new Map<string, ImportedHdRoot>()
    const pendingMetadata: MigratedAccountPair[] = []

    for (const account of orderForImport(args.accounts)) {
        // When this iteration removes a watch account to reconcile it, keep the
        // removed record so a failed reimport can restore it instead of
        // orphaning the user's visible account.
        let removedForReconcile: WalletAccount | null = null
        if (existingAddresses.has(account.address)) {
            const existing = useAccountsStore
                .getState()
                .accounts.find(a => a.address === account.address)
            const hasSigningMaterial =
                (account.secretKey !== null && account.secretKey.length > 0) ||
                account.hdWalletId !== null

            if (existing?.type === AccountTypes.watch && hasSigningMaterial) {
                // Earlier migration builds imported this as watch (key was
                // withheld natively); reimport now that the key is present.
                removeAccountFromStore(account.address)
                existingAddresses.delete(account.address)
                removedForReconcile = existing
                // fall through to the import path below
            } else {
                if (
                    existing?.type === AccountTypes.watch &&
                    existing.rekeyAddress === undefined &&
                    account.authAddress !== null
                ) {
                    applyRekeyAddressToStoreAccount(
                        account.address,
                        account.authAddress,
                    )
                }
                summary.skipped += 1
                continue
            }
        }

        try {
            const created = await migrateLegacyAccount({
                account,
                hdWalletsById,
                importedHdRoots,
                importAccount: args.importAccount,
                createHdWalletAccount: args.createHdWalletAccount,
                createHDWalletKey: args.createHDWalletKey,
                hasSeedWithEntropy: args.hasSeedWithEntropy,
            })
            existingAddresses.add(created.address)
            pendingMetadata.push({ created, legacy: account })
            summary.imported += 1
        } catch (e) {
            if (removedForReconcile !== null) {
                // Restore the watch account we removed for reconciliation so a
                // transient reimport failure never leaves the user's account
                // permanently gone; it will be retried next launch.
                addKeylessAccountToStore(removedForReconcile)
                existingAddresses.add(removedForReconcile.address)
            }
            const route = classifyLegacyAccountRoute(account)
            const errorName = e instanceof Error ? e.name : 'Unknown'
            const errorMessage = e instanceof Error ? e.message : String(e)
            const reason = `[${route}] ${errorName}: ${errorMessage}`
            logger.error('Legacy account migration failed', {
                address: account.address,
                route,
                error: e,
            })
            summary.failed.push({
                address: account.address,
                name: account.name,
                reason,
            })
        }
    }

    for (const undecodable of args.undecodableAccounts ?? []) {
        if (existingAddresses.has(undecodable.address)) {
            summary.skipped += 1
            continue
        }
        logger.error('Legacy account undecodable; recording as failure', {
            address: undecodable.address,
        })
        summary.failed.push({
            address: undecodable.address,
            name: undecodable.name,
            reason: `[undecodable] ${undecodable.error}`,
        })
    }

    applyAllLegacyMetadata(pendingMetadata)
    markLegacyBackedUpAccounts(pendingMetadata, args.markAccountBackedUp)
    // First-run only: on a re-run the store already holds the user's own
    // ordering (incl. Pera-7-native accounts), and reapplying the legacy Pera 6
    // order would clobber it.
    if (!args.isRerun) applyLegacyAccountOrder(args.accounts)

    return summary
}

const orderForImport = (accounts: LegacyAccount[]): LegacyAccount[] => {
    const keyBearing: LegacyAccount[] = []
    const keylessIndependent: LegacyAccount[] = []
    const multisig: LegacyAccount[] = []

    for (const account of accounts) {
        if (account.joint !== null) multisig.push(account)
        else if (isKeylessLegacyAccount(account))
            keylessIndependent.push(account)
        else keyBearing.push(account)
    }

    return [...keyBearing, ...keylessIndependent, ...multisig]
}
