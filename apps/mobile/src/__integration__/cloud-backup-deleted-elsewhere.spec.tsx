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

import '../i18n'
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    deleteBackupKeys,
    deriveBackupKeys,
    hasBackupCredentials,
    useBackupSyncStateStore,
    useCloudBackupStore,
    useShouldPromptMnemonicBackup,
} from '@perawallet/wallet-core-backup'
import { buildSyncHandlers } from '@perawallet/wallet-core-backup/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    configureBackup,
    fundOnAlgorandMainnet,
    seedAlgo25Account,
    startRealSyncManager,
} from './__fixtures__/cloudBackup'
import { addressOf } from './__fixtures__/accounts'

const queryClient = createTestQueryClient()
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('Flow: Cloud Backup deleted on another device', () => {
    let account: WalletAccount
    const onBackupDeleted = vi.fn()

    const syncOnce = async () => {
        const keys = await deriveBackupKeys({
            mnemonic: BACKUP_MNEMONIC,
            salt: BACKUP_SALT,
        })
        await configureBackup(keys)
        const sync = buildSyncHandlers({ backupId: keys.backupId })
        server.use(...sync.handlers)
        const manager = startRealSyncManager({ onBackupDeleted })
        await manager.syncNow()
        return { keys, sync, manager }
    }

    const renderPrompt = () =>
        renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    account,
                    useSelectedScope(ALGORAND_CHAIN_ID),
                ),
            { wrapper },
        )

    const expectBackupCleared = () => {
        expect(useCloudBackupStore.getState().backupId).toBeNull()
        expect(useBackupSyncStateStore.getState().syncState).toBeNull()
        expect(hasBackupCredentials()).toBe(false)
    }

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().mode, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()

        account = await seedAlgo25Account()
        useAccountsStore.getState().setAccounts([account])
        await fundOnAlgorandMainnet(addressOf(account))
    })

    it('Given the backup was deleted elsewhere, when a sync finds out, then the local backup is cleared once and the warning returns', async () => {
        const { sync, manager } = await syncOnce()
        const { result } = renderPrompt()
        await waitFor(() => expect(result.current).toBe(false))

        sync.deleteFromOtherDevice()
        await manager.syncNow()

        expectBackupCleared()
        expect(onBackupDeleted).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(result.current).toBe(true))

        await manager.syncNow()
        expect(onBackupDeleted).toHaveBeenCalledTimes(1)
    })

    it('Given the backup was deleted elsewhere, when a pull finds out, then the local backup is cleared once', async () => {
        const { sync, manager } = await syncOnce()

        sync.deleteFromOtherDevice()
        await manager.handleSocketEvent({
            kind: 'itemsUpdated',
            fromSeq: 1,
            toSeq: 2,
        })

        expectBackupCleared()
        expect(onBackupDeleted).toHaveBeenCalledTimes(1)
    })

    it('Given a plain 401, when a sync runs, then it is a failed sync and the backup stays', async () => {
        const { keys, sync, manager } = await syncOnce()

        sync.failAuth()
        await manager.syncNow()

        expect(useBackupSyncStateStore.getState().syncState).toMatchObject({
            lastSyncResult: 'FAILED',
        })
        expect(useCloudBackupStore.getState().backupId).toBe(keys.backupId)
        expect(hasBackupCredentials()).toBe(true)
        expect(onBackupDeleted).not.toHaveBeenCalled()
    })
})
