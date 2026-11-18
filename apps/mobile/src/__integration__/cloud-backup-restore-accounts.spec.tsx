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
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { Notifier } from 'react-native-notifier'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    chainAccountOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    deleteBackupKeys,
    deriveBackupKeys,
    hasBackupCredentials,
    useBackupSyncStateStore,
    useCloudBackupRestoreDraftStore,
    useCloudBackupRestoreSessionStore,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import {
    accountRecordItemKey,
    buildSyncHandlers,
    secretsItemKey,
} from '@perawallet/wallet-core-backup/test-handlers'
import { parseEthereumPrivateKey } from '@perawallet/wallet-core-chain-ethereum'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { usePinCode } from '@perawallet/wallet-core-security'
import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    configureBackup,
    confirmRestoreAccounts,
    DEVICE_ID,
    enterRestoreCredentials,
    renderCloudBackupFlow,
    runRestoreFlow,
    seedAlgo25Account,
    seedHDWalletAccounts,
    startRealSyncManager,
    wipeDevice,
} from './__fixtures__/cloudBackup'
import { addressOf } from './__fixtures__/accounts'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    PIN_FLOW_TEST_TIMEOUT_MS,
    SLOW_WAIT_TIMEOUT_MS,
} from './__fixtures__/timeouts'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// Hardhat's first development account: a published test key, never funded on mainnet.
const TEST_PRIVATE_KEY =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_PIN = '123456'

const backupKeys = () =>
    deriveBackupKeys({ mnemonic: BACKUP_MNEMONIC, salt: BACKUP_SALT })

/** A backup another device pushed, holding the accounts `seed` puts there;
 *  the device is wiped afterwards. Returns the fake backend and the hasher. */
const backupFromAnotherDevice = async (seed: () => Promise<unknown>) => {
    const keys = await backupKeys()
    const backend = buildSyncHandlers({ backupId: keys.backupId })
    server.use(...backend.handlers)
    await seed()
    const hashAddress = await configureBackup(keys)
    await startRealSyncManager().syncNow()
    await wipeDevice()
    return { ...backend, hashAddress }
}

/** This device's own accounts, none of them in the backup. */
const seedDeviceAccounts = async () => {
    const evm = await useAccountsStore
        .getState()
        .importAccountFromPrivateKey(
            'ethereum',
            parseEthereumPrivateKey(TEST_PRIVATE_KEY),
        )
    const { first } = await seedHDWalletAccounts({ isAdditionalWallet: true })
    return {
        evmAddress: chainAccountOf(evm, 'ethereum')!.address,
        hdAddress: addressOf(first),
    }
}

const savePin = async (pin: string | null = TEST_PIN) => {
    const { result } = renderHook(() => usePinCode())
    await act(async () => {
        await result.current.savePin(pin)
    })
}

const walletAddresses = () =>
    useAccountsStore.getState().accounts.map(account => addressOf(account))

describe(
    'Flow: Cloud backup → Restore, choosing accounts',
    { timeout: PIN_FLOW_TEST_TIMEOUT_MS },
    () => {
        beforeAll(async () => {
            await setupTestDatabase()
        })

        afterAll(async () => {
            await teardownTestDatabase()
        })

        beforeEach(async () => {
            await resetTestDatabase()
            resetTestKeystore()
            useAccountsStore.getState().setAccounts([])
            useCloudBackupStore.getState().resetState()
            useBackupSyncStateStore.getState().resetState()
            useCloudBackupRestoreDraftStore.getState().resetState()
            useCloudBackupRestoreSessionStore.getState().resetState()
            useDeviceStore
                .getState()
                .setDeviceID(useNetworkStore.getState().mode, DEVICE_ID)
            await deleteBackupKeys().catch(() => undefined)
            await savePin(null)
            vi.mocked(Notifier.showNotification).mockClear()
        })

        it('Given a wallet with an EVM raw-key account and an HD account the backup lacks, when the user restores, then the notice shows and nothing is uploaded until they agree', async () => {
            const { getItem, hashAddress } =
                await backupFromAnotherDevice(seedAlgo25Account)
            const { evmAddress, hdAddress } = await seedDeviceAccounts()
            const evmSecret = secretsItemKey(hashAddress(evmAddress))
            const hdSecret = secretsItemKey(hashAddress(hdAddress))

            renderCloudBackupFlow()
            await enterRestoreCredentials()

            expect(
                await screen.findByTestId(
                    'cloud_backup_restore_accounts_device_notice',
                    {},
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                ),
            ).toBeTruthy()
            await startRealSyncManager().syncNow()
            expect(getItem(evmSecret)).toBeUndefined()
            expect(getItem(hdSecret)).toBeUndefined()

            await confirmRestoreAccounts()
            await screen.findByTestId(
                'cloud_backup_overview_screen',
                {},
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
            await startRealSyncManager().syncNow()

            // Agreeing is what joins them: the device's accounts sync from here on.
            expect(getItem(evmSecret)).toBeDefined()
            expect(getItem(hdSecret)).toBeDefined()
        })

        it('Given the notice, when the user leaves instead of agreeing, then the device holds no backup keys and nothing is uploaded', async () => {
            const { getItem, hashAddress } =
                await backupFromAnotherDevice(seedAlgo25Account)
            const { evmAddress } = await seedDeviceAccounts()

            const { unmount } = renderCloudBackupFlow()
            await enterRestoreCredentials()
            await screen.findByTestId(
                'cloud_backup_restore_accounts_device_notice',
                {},
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            )
            unmount()

            await waitFor(() => expect(hasBackupCredentials()).toBe(false))
            expect(useCloudBackupStore.getState().isConfigured()).toBe(false)
            await startRealSyncManager().syncNow()
            expect(
                getItem(secretsItemKey(hashAddress(evmAddress))),
            ).toBeUndefined()
        })

        it('Given a PIN, when the user restores, then the backup is not unlocked until the PIN is entered', async () => {
            await backupFromAnotherDevice(seedAlgo25Account)
            await savePin()

            renderCloudBackupFlow()
            await enterRestoreCredentials()

            await screen.findByTestId('numpad_key_1')
            expect(
                screen.queryByTestId('cloud_backup_restore_accounts_screen'),
            ).toBeNull()
            expect(hasBackupCredentials()).toBe(false)

            for (const digit of TEST_PIN) {
                await act(async () => {
                    fireEvent.click(screen.getByTestId(`numpad_key_${digit}`))
                })
            }

            expect(
                await screen.findByTestId(
                    'cloud_backup_restore_accounts_screen',
                    {},
                    { timeout: SLOW_WAIT_TIMEOUT_MS },
                ),
            ).toBeTruthy()
        })

        it('Given a PIN, when the user closes the PIN prompt, then nothing is restored', async () => {
            await backupFromAnotherDevice(seedAlgo25Account)
            await savePin()

            renderCloudBackupFlow()
            await enterRestoreCredentials()
            fireEvent.click(await screen.findByTestId('close-button'))

            await waitFor(() =>
                expect(screen.queryByTestId('numpad_key_1')).toBeNull(),
            )
            expect(
                screen.queryByTestId('cloud_backup_restore_accounts_screen'),
            ).toBeNull()
            expect(hasBackupCredentials()).toBe(false)
            expect(walletAddresses()).toEqual([])
        })

        it('Given a backup with an Algo25 account and two HD accounts, when the user selects one HD account, then only it lands and the others stay in the backup to add later', async () => {
            let seedAddress = ''
            const { hashAddress } = await backupFromAnotherDevice(async () => {
                const algo25 = await seedAlgo25Account()
                const { first } = await seedHDWalletAccounts({
                    isAdditionalWallet: true,
                })
                seedAddress = addressOf(first)
                return algo25
            })
            const firstGroup = `${seedAddress}/0/0`
            const secondGroup = `${seedAddress}/0/1`

            renderCloudBackupFlow()
            await runRestoreFlow([secondGroup])

            await waitFor(() => expect(walletAddresses()).toHaveLength(1))
            expect(walletAddresses()).not.toContain(ALGO25_TEST_ADDRESS)
            expect(walletAddresses()).not.toContain(seedAddress)
            expect(useAccountsStore.getState().accounts[0]?.name).toBe(
                'HD Second',
            )

            const items =
                useBackupSyncStateStore.getState().syncState?.items ?? {}
            expect(
                items[accountRecordItemKey(hashAddress(firstGroup))]
                    ?.pendingImport,
            ).toBe(true)
            expect(
                items[accountRecordItemKey(hashAddress(secondGroup))]
                    ?.pendingImport,
            ).toBeUndefined()
            // The restored account derives from this seed, so it stays live.
            expect(
                items[secretsItemKey(hashAddress(seedAddress))]?.pendingImport,
            ).toBeUndefined()
        })

        it('Given a backup with several accounts, when the user keeps All Accounts, then every account lands', async () => {
            await backupFromAnotherDevice(async () => {
                await seedAlgo25Account()
                await seedHDWalletAccounts({ isAdditionalWallet: true })
            })

            renderCloudBackupFlow()
            await runRestoreFlow()

            await waitFor(() => expect(walletAddresses()).toHaveLength(3))
            expect(walletAddresses()).toContain(ALGO25_TEST_ADDRESS)
        })
    },
)
