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
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAlgorandAccountState,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    insertAssetHolding,
    refreshAccountHoldings,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    deleteBackupKeys,
    deriveBackupKeys,
    useBackupSyncStateStore,
    useCloudBackupStore,
    useDisableCloudBackupMutation,
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
    seedAlgo25Account,
    startRealSyncManager,
} from './__fixtures__/cloudBackup'
import { addressOf } from './__fixtures__/accounts'

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const

const fundOnMainnet = async (address: string) => {
    await seedAlgorandAccountState({
        accountAddress: address,
        scope: SCOPE,
        nativeBalance: new Decimal(0),
        minBalance: new Decimal(100_000),
    })
    await insertAssetHolding({
        accountAddress: address,
        assetId: '0',
        scope: SCOPE,
        amount: new Decimal(0),
    })
    await refreshAccountHoldings({
        accountAddress: address,
        scope: SCOPE,
        holdings: [{ assetId: '0', amount: new Decimal(5_000_000) }],
    })
}

const queryClient = createTestQueryClient()
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('Flow: the backup warning follows Cloud Backup coverage', () => {
    let account: WalletAccount

    const backUpAndSync = async () => {
        const keys = await deriveBackupKeys({
            mnemonic: BACKUP_MNEMONIC,
            salt: BACKUP_SALT,
        })
        await configureBackup(keys)
        server.use(...buildSyncHandlers({ backupId: keys.backupId }).handlers)
        await startRealSyncManager().syncNow()
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
        await fundOnMainnet(addressOf(account))
    })

    it('Given a funded account never backed up, then the prompt is true', async () => {
        const { result } = renderPrompt()

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given a successful sync of a confirmed backup, then the prompt is false', async () => {
        await backUpAndSync()

        const { result } = renderPrompt()

        await waitFor(() => expect(result.current).toBe(false))
    })

    it('Given the credentials are unconfirmed, then the prompt stays true', async () => {
        await backUpAndSync()
        const { result } = renderPrompt()
        await waitFor(() => expect(result.current).toBe(false))

        await act(async () => {
            useCloudBackupStore.setState({ credentialsConfirmed: false })
        })

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given Cloud Backup is turned off, then the prompt returns, and clears again after it is turned back on and synced', async () => {
        await backUpAndSync()
        const { result } = renderPrompt()
        await waitFor(() => expect(result.current).toBe(false))

        const { result: disable } = renderHook(
            () => useDisableCloudBackupMutation(),
            { wrapper },
        )
        await act(async () => {
            await disable.current.mutateAsync()
        })
        await waitFor(() => expect(result.current).toBe(true))

        await backUpAndSync()
        await waitFor(() => expect(result.current).toBe(false))
    })
})
