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

import React from 'react'
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
import { renderHook, waitFor } from '@testing-library/react'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@test-utils/render'
import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    deriveBackupKeys,
    persistBackupKeys,
    deleteBackupKeys,
    useCloudBackupStore,
    useBackupSyncStateStore,
    initializeBackupSyncManager,
    getBackupSyncManager,
    type WebSocketLike,
} from '@perawallet/wallet-core-backup'
import { buildSyncHandlers } from '@perawallet/wallet-core-backup/test-handlers'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    useCloudBackupImport,
    useResolveMnemonicForBackup,
} from '@modules/cloud-backup'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'

// The full sync round-trip runs argon2 → HKDF → keystore reveal →
// AES-256-GCM encrypt → upsert. Comfortably past the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

// Any twelve wordlist words: the cloud-backup KDF hashes the phrase and never
// checks a BIP39 checksum, so these don't need to form a valid mnemonic.
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

const BACKUP_SALT = Buffer.from(new Uint8Array(16).fill(7)).toString('base64')

const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await waitFor(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
        })
        expect(key).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'algo25-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: key!.seedKey.id ?? '',
        name: 'Algo25 Test',
    }
    useAccountsStore.getState().setAccounts([account])
    return account
}

const renderQueryHook = <T,>(hook: () => T) => {
    const queryClient: QueryClient = createTestQueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
    return renderHook(hook, { wrapper }).result
}

describe('Flow: Cloud backup → real-time manager', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

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

            // `withBackupEncryptionKey` / `withBackupAuthSecretKey` inside the
            // manager read these back out of the keystore.
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

            const { handlers, getItem } = buildSyncHandlers({ backupId })
            server.use(...handlers)

            let socket: WebSocketLike | null = null
            let socketUrl = ''
            const fakeSocketFactory = (url: string): WebSocketLike => {
                socketUrl = url
                socket = {
                    onopen: null,
                    onmessage: null,
                    onerror: null,
                    onclose: null,
                    close: () => undefined,
                }
                return socket
            }

            const importHook = renderQueryHook(() => useCloudBackupImport())
            const mnemonicHook = renderQueryHook(() =>
                useResolveMnemonicForBackup(),
            )

            const manager = initializeBackupSyncManager({
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
            // Scheme follows the configured backup base URL, so a local
            // http backend is ws:// while staging is wss://.
            expect(socketUrl).toMatch(/^wss?:\/\//)
            expect(socketUrl).toContain('signature=')

            // ITEMS_UPDATED drives handleSocketEvent → runPull, which must
            // complete without knocking the sync state off SUCCESS.
            socket!.onmessage?.({
                data: JSON.stringify({
                    type: 'ITEMS_UPDATED',
                    from_seq: 99,
                    to_seq: 99,
                }),
            })
            await waitFor(
                () =>
                    expect(
                        useBackupSyncStateStore.getState().syncState
                            ?.lastSyncResult,
                    ).toBe('SUCCESS'),
                { timeout: 10_000 },
            )

            manager.stop()
            // stop() tears the socket down but keeps the singleton addressable.
            expect(() => getBackupSyncManager()).not.toThrow()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
