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
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    useCloudBackupStore,
    useBackupSyncStateStore,
    initializeBackupSyncManager,
    BackupAccountType,
    type BackupSyncManager,
    type WebSocketLike,
} from '@perawallet/wallet-core-backup'
import {
    buildSyncHandlers,
    encryptItemPayload,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    useCloudBackupImport,
    useResolveMnemonicForBackup,
} from '@modules/cloud-backup'

import {
    BACKUP_MNEMONIC,
    BACKUP_SALT,
    SLOW_TEST_TIMEOUT_MS,
    renderQueryHook,
    seedAlgo25Account,
} from './__fixtures__/cloudBackup'
import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

// Any valid address this wallet doesn't hold. Watch is the cheapest type to
// pull — an address record with no secrets item behind it.
const REMOTE_WATCH_ADDRESS = HD_TEST_ADDRESS

const NORMAL_SOCKET_CLOSE = 1000

describe('Flow: Cloud backup → real-time manager', () => {
    let manager: BackupSyncManager | null = null

    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterAll(() => server.close())

    // Unconditional: a failed assertion must not leave start()'s poll interval
    // and socket running into the next test.
    afterEach(() => {
        manager?.stop()
        manager = null
        server.resetHandlers()
    })

    beforeEach(async () => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().network, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)
        vi.clearAllMocks()
    })

    it(
        'start() pushes the local account + connects WS; an ITEMS_UPDATED triggers a pull',
        async () => {
            const account = await seedAlgo25Account()

            const { backupId, encryptionKey, authSecretKey } =
                await deriveBackupKeys({
                    mnemonic: BACKUP_MNEMONIC,
                    salt: BACKUP_SALT,
                })

            await persistBackupKeys({
                encryptionKey,
                authSecretKey,
                mnemonic: BACKUP_MNEMONIC,
            })
            useCloudBackupStore.getState().setConfigured({
                backupId,
                salt: BACKUP_SALT,
                deviceId: 'test-device-id',
            })

            const { handlers, getItem, pushFromOtherDevice } =
                buildSyncHandlers({
                    backupId,
                })
            server.use(...handlers)

            let socket: WebSocketLike | null = null
            let socketUrl = ''
            const close = vi.fn()
            const fakeSocketFactory = (url: string): WebSocketLike => {
                socketUrl = url
                socket = {
                    onopen: null,
                    onmessage: null,
                    onerror: null,
                    onclose: null,
                    close,
                }
                return socket
            }

            const importHook = renderQueryHook(() => useCloudBackupImport())
            const mnemonicHook = renderQueryHook(() =>
                useResolveMnemonicForBackup(),
            )

            manager = initializeBackupSyncManager({
                importAccounts: importHook.current.importAccounts,
                resolveMnemonic: mnemonicHook.current,
                resolveHd: async () => null,
                socketFactory: fakeSocketFactory,
            })

            await manager.start()

            // start() runs a full sync before opening the socket.
            await waitFor(
                () =>
                    expect(
                        getItem(`accounts/${account.address}`),
                    ).toBeDefined(),
                { timeout: 10_000 },
            )
            expect(
                useBackupSyncStateStore.getState().syncState?.lastSyncResult,
            ).toBe('SUCCESS')

            await waitFor(() => expect(socket).not.toBeNull())
            // Scheme follows the configured backup base URL: a local http
            // backend is ws://, staging is wss://.
            expect(socketUrl).toMatch(/^wss?:\/\//)
            // backupId stays raw in the path — the server route and the Android
            // client both expect it unencoded.
            expect(socketUrl).toContain(`/backup/${backupId}?`)
            expect(socketUrl).toContain('device_id=test-device-id')
            expect(socketUrl).toContain('signature=')

            const seqBeforePull =
                useBackupSyncStateStore.getState().syncState?.lastSyncedSeq ?? 0

            const remoteKey = `accounts/${REMOTE_WATCH_ADDRESS}`
            pushFromOtherDevice(
                remoteKey,
                encryptItemPayload(
                    JSON.stringify({
                        type: BackupAccountType.watch,
                        address: REMOTE_WATCH_ADDRESS,
                        customName: 'Pulled Over Socket',
                        updatedAt: 1,
                    }),
                    { encryptionKey, backupId, key: remoteKey },
                ),
            )
            expect(
                useAccountsStore
                    .getState()
                    .accounts.some(a => a.address === REMOTE_WATCH_ADDRESS),
            ).toBe(false)

            socket!.onmessage?.({
                data: JSON.stringify({
                    type: 'ITEMS_UPDATED',
                    from_seq: seqBeforePull,
                    to_seq: getItem(remoteKey)!.seq,
                }),
            })
            await waitFor(
                () =>
                    expect(
                        useAccountsStore
                            .getState()
                            .accounts.find(
                                a => a.address === REMOTE_WATCH_ADDRESS,
                            ),
                    ).toMatchObject({
                        type: AccountTypes.watch,
                        name: 'Pulled Over Socket',
                    }),
                { timeout: 10_000 },
            )
            expect(
                useBackupSyncStateStore.getState().syncState?.lastSyncedSeq,
            ).toBeGreaterThan(seqBeforePull)

            manager!.stop()
            expect(close).toHaveBeenCalledWith(NORMAL_SOCKET_CLOSE)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
