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
    chainAccountOf,
    isWatchAccount,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getSecretMetadata, hasSecret } from '@perawallet/wallet-core-kms'
import {
    logger,
    toError,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type {
    LegacyAccount,
    LegacyMigrationData,
    MigrationService,
    MigrationStepVersions,
} from '@perawallet/wallet-extension-platform'
import { getKeystore } from '@perawallet/wallet-extension-provider'
import { useMigrationGateStore, type LegacyWipeBlock } from '../store'
import { scrubLegacyPayloadSecrets } from './scrubLegacyPayload'
import {
    ALL_MIGRATION_STEPS,
    pendingStepsFromVersions,
    resolveCompletedStepVersions,
} from './stepVersions'

export type LegacyWipeOutcome =
    | 'wiped'
    | 'no-legacy-data'
    | 'accounts-not-hydrated'
    | 'steps-pending'
    | 'still-blocked'
    | 'undecodable-accounts'
    | 'keys-held-as-watch'
    | 'keys-missing-from-keystore'
    | 'failed'

type BlockingReason = Extract<
    LegacyWipeOutcome,
    'undecodable-accounts' | 'keys-held-as-watch' | 'keys-missing-from-keystore'
>

type WipeBlockFinding = { reason: BlockingReason; addresses: string[] }

const hasSigningMaterial = (account: LegacyAccount): boolean =>
    (account.secretKey !== null && account.secretKey.length > 0) ||
    account.hdSeedId !== null

// An HD child is only usable while the seed it derives from is still held.
const holdsKey = (keyPairId: Optional<string>): boolean => {
    if (!keyPairId || !hasSecret(keyPairId)) return false
    const parentKeyId = getSecretMetadata(keyPairId)?.parentKeyId
    return typeof parentKeyId !== 'string' || hasSecret(parentKeyId)
}

const migratedAccountsByAddress = (
    chainId: ChainId,
): Map<string, WalletAccount> => {
    const byAddress = new Map<string, WalletAccount>()
    for (const account of useAccountsStore.getState().accounts) {
        const address = chainAccountOf(account, chainId)?.address
        if (address) byAddress.set(address, account)
    }
    return byAddress
}

// An account the user removed after migrating no longer needs its legacy key.
const accountBlockReason = (
    migrated: Optional<WalletAccount>,
    chainId: ChainId,
): Nullable<BlockingReason> => {
    if (!migrated) return null
    // A later accounts-step bump re-imports these from the legacy keys.
    if (isWatchAccount(migrated)) return 'keys-held-as-watch'
    return holdsKey(chainAccountOf(migrated, chainId)?.keyPairId)
        ? null
        : 'keys-missing-from-keystore'
}

const findBlock = (
    data: LegacyMigrationData,
    chainId: ChainId,
): Nullable<WipeBlockFinding> => {
    // A future decoder fix can only recover these from the legacy store.
    if (data.undecodableAccounts.length > 0) {
        return { reason: 'undecodable-accounts', addresses: [] }
    }
    const byAddress = migratedAccountsByAddress(chainId)
    let reason: Nullable<BlockingReason> = null
    const addresses: string[] = []
    for (const legacy of data.accounts) {
        if (!hasSigningMaterial(legacy)) continue
        const accountReason = accountBlockReason(
            byAddress.get(legacy.address),
            chainId,
        )
        if (accountReason === null) continue
        addresses.push(legacy.address)
        if (reason !== 'keys-held-as-watch') reason = accountReason
    }
    return reason === null ? null : { reason, addresses }
}

// Checks only the accounts store and keystore, never the legacy payload.
const isStillBlocked = (
    block: Nullable<LegacyWipeBlock>,
    completed: MigrationStepVersions,
    chainId: ChainId,
): boolean => {
    if (block === null) return false
    const isSameVersions = ALL_MIGRATION_STEPS.every(
        step => block.versions[step] === completed[step],
    )
    if (!isSameVersions) return false
    if (block.addresses.length === 0) return true
    const byAddress = migratedAccountsByAddress(chainId)
    return block.addresses.some(
        address => accountBlockReason(byAddress.get(address), chainId) !== null,
    )
}

/**
 * Deletes the Pera 6 store (keys, HD entropy, PIN) once every migration step
 * is at its target version and nothing in it is still needed to recover an
 * account. Never throws: any failure leaves the store for the next launch.
 */
export const wipeMigratedLegacyData = async (
    migration: MigrationService,
    chainId: ChainId,
): Promise<LegacyWipeOutcome> => {
    const outcome = await resolveAndWipe(migration, chainId)
    if (outcome !== 'no-legacy-data') {
        logger.info('[Migration] legacy data wipe', { outcome })
    }
    return outcome
}

const resolveAndWipe = async (
    migration: MigrationService,
    chainId: ChainId,
): Promise<LegacyWipeOutcome> => {
    try {
        // Before rehydration the account list is empty, which would hide a
        // watch-held key and wipe it.
        if (!useAccountsStore.persist.hasHydrated()) {
            return 'accounts-not-hydrated'
        }
        if (!(await migration.hasLegacyData())) return 'no-legacy-data'
        // Until its metadata loads, every key would read as missing.
        await getKeystore().ready
        const completed = await resolveCompletedStepVersions(migration)
        if (pendingStepsFromVersions(completed).length > 0) {
            return 'steps-pending'
        }
        const gate = useMigrationGateStore.getState()
        // Reading the payload brings every legacy secret into the JS heap as
        // base64 strings that can't be zeroed, so a refused wipe is retried
        // only once something that refused it has changed.
        if (isStillBlocked(gate.legacyWipeBlock, completed, chainId)) {
            return 'still-blocked'
        }

        const data = await migration.getLegacyData()
        let block: Nullable<WipeBlockFinding>
        try {
            block = findBlock(data, chainId)
        } finally {
            scrubLegacyPayloadSecrets(data)
        }
        if (block !== null) {
            gate.setLegacyWipeBlock({
                versions: completed,
                addresses: block.addresses,
            })
            return block.reason
        }

        await migration.wipeLegacyData()
        gate.setLegacyWipeBlock(null)
        return 'wiped'
    } catch (err) {
        logger.error('[Migration] legacy data wipe failed', {
            error: toError(err),
        })
        return 'failed'
    }
}
