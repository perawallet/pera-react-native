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
    deriveHdAccount,
    discoverAccounts,
    seedOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    createBackupSyncStoreSources,
    deleteBackupKeys,
    deriveBackupKeys,
    initializeBackupSyncManager,
    persistBackupKeys,
    useBackupSyncStateStore,
    useCloudBackupRestoreDraftStore,
    useCloudBackupStore,
    type BackupSyncManager,
} from '@perawallet/wallet-core-backup'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { benchScope } from '../data/scope'
import { fastLookupHandlers } from '../network/discoveryFixtures'
import { buildSyncHandlers } from '../network/handlers'
import type { Scenario, ScenarioContext } from '../runner/types'
import { discardAccountKeys } from './keys'

const IMPORT_SCALES = ['S', 'M', 'L'] as const
const BACKUP_SCALES = ['S', 'M'] as const
const DEVICE_ID = 'bench-device-id'

// Any twelve wordlist words: the cloud-backup KDF hashes the phrase and never
// checks a BIP39 checksum.
const BACKUP_MNEMONIC = [
    'abandon',
    'ability',
    'able',
    'about',
    'above',
    'absent',
    'absorb',
    'abstract',
    'absurd',
    'abuse',
    'access',
    'accident',
]
const BACKUP_SALT = btoa(String.fromCharCode(...new Uint8Array(16).fill(7)))

type DiscoveryState = { seedKeyId: string; expected: number }

const hdDiscovery: Scenario<DiscoveryState> = {
    id: 'import.hd-discovery',
    group: 'import',
    title: 'Discover every active account of a recovered HD wallet',
    scales: IMPORT_SCALES,
    iterations: 3,
    warmup: 0,
    setup: async (ctx, scale) => {
        const scope = benchScope()
        const first = await ctx.createHdWalletAccount({
            account: 0,
            keyIndex: 0,
        })
        const seedKeyId = seedOf(first)
        if (!seedKeyId) throw new Error('The minted HD account has no seed')

        const active = new Set<string>()
        for (let account = 0; account < scale.accounts; account++) {
            active.add(
                (
                    await deriveHdAccount(scope, seedKeyId, {
                        account,
                        keyIndex: 0,
                    })
                ).address,
            )
        }
        ctx.network.use(...fastLookupHandlers(active))
        return { seedKeyId, expected: active.size }
    },
    run: async ({ seedKeyId, expected }) => {
        const scope = benchScope()
        const found = await discoverAccounts({
            scope,
            walletKeyId: seedKeyId,
            getPublicKey: async hd =>
                (await deriveHdAccount(scope, seedKeyId, hd)).publicKey,
        })
        if (found.length < expected) {
            throw new Error(
                `Discovery found ${found.length} of ${expected} accounts`,
            )
        }
    },
    teardown: async ({ seedKeyId }) => {
        await kmsCore.discardMintedSeed(seedKeyId).catch(() => {})
    },
}

const registerDevice = (): void => {
    useDeviceStore
        .getState()
        .setDeviceID(useNetworkStore.getState().mode, DEVICE_ID)
}

const resetBackupStores = (): void => {
    useCloudBackupStore.getState().resetState()
    useBackupSyncStateStore.getState().resetState()
    useCloudBackupRestoreDraftStore.getState().resetState()
}

type BackedUp = {
    backupId: string
    manager: BackupSyncManager
}

/**
 * Real Algo25 accounts, configured for backup against the fixture backend.
 * Nothing is pushed yet.
 */
const prepareBackup = async (
    ctx: ScenarioContext,
    accounts: number,
): Promise<BackedUp> => {
    for (let i = 0; i < accounts; i++) {
        await ctx.createSingleKeyAccount({ seed: null })
    }
    const { backupId, encryptionKey, authSecretKey, itemKey } =
        await deriveBackupKeys({ mnemonic: BACKUP_MNEMONIC, salt: BACKUP_SALT })
    await persistBackupKeys({
        encryptionKey,
        authSecretKey,
        itemKey,
        mnemonic: BACKUP_MNEMONIC,
    })
    registerDevice()
    useCloudBackupStore.getState().setConfigured({
        backupId,
        salt: BACKUP_SALT,
        deviceId: DEVICE_ID,
    })
    const manager = initializeBackupSyncManager({
        chainId: LEGACY_CHAIN_ID,
        sources: createBackupSyncStoreSources(LEGACY_CHAIN_ID),
        ...ctx.backupSyncDeps,
        isLocked: () => false,
        listPasskeys: async () => [],
        importPasskeys: async () => ({ imported: 0, skipped: [], failed: [] }),
        subscribePasskeyChanges: () => () => {},
    })
    return { backupId, manager }
}

const wipeDevice = async (): Promise<void> => {
    await discardAccountKeys(useAccountsStore.getState().accounts)
    useAccountsStore.getState().setAccounts([])
    resetBackupStores()
    await deleteBackupKeys().catch(() => undefined)
}

type RestoreState = { ctx: ScenarioContext }

// Restored out of what a real push wrote: a hand-made fixture would keep
// passing against a payload shape nothing produces.
const restore: Scenario<RestoreState> = {
    id: 'backup.restore',
    group: 'backup',
    title: 'Restore a cloud backup of Algo25 accounts',
    scales: BACKUP_SCALES,
    iterations: 3,
    warmup: 0,
    setup: async (ctx, scale) => {
        const { backupId, manager } = await prepareBackup(ctx, scale.accounts)
        ctx.network.use(...buildSyncHandlers({ backupId }).handlers)
        await manager.syncNow()
        manager.stop()

        // The device is wiped; the fixture backend keeps what was pushed.
        await wipeDevice()
        registerDevice()
        useCloudBackupRestoreDraftStore.getState().setMnemonic(BACKUP_MNEMONIC)
        return { ctx }
    },
    run: ({ ctx }) =>
        ctx.restoreCloudBackup({ salt: BACKUP_SALT }).then(() => {}),
    // The next run restores into a wallet with nothing in it.
    afterEach: async () => {
        await discardAccountKeys(useAccountsStore.getState().accounts)
        useAccountsStore.getState().setAccounts([])
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
    },
    teardown: async () => {
        await wipeDevice()
    },
}

const backupSync: Scenario<BackedUp & { ctx: ScenarioContext }> = {
    id: 'backup.sync',
    group: 'backup',
    title: 'Push a whole wallet of Algo25 accounts to an empty backup',
    scales: BACKUP_SCALES,
    iterations: 3,
    warmup: 0,
    setup: async (ctx, scale) => ({
        ctx,
        ...(await prepareBackup(ctx, scale.accounts)),
    }),
    // A fresh server and fresh sync state, so every run pushes the lot.
    beforeEach: async ({ ctx, backupId }) => {
        useBackupSyncStateStore.getState().resetState()
        ctx.network.use(...buildSyncHandlers({ backupId }).handlers)
    },
    run: ({ manager }) => manager.syncNow(),
    teardown: async ({ manager }) => {
        manager.stop()
        await wipeDevice()
    },
}

export const importAndBackupScenarios: Scenario[] = [
    hdDiscovery as Scenario,
    restore as Scenario,
    backupSync as Scenario,
]
