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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useCloudBackupStore,
    useBackupSyncStateStore,
    deriveBackupSyncStatus,
} from '@perawallet/wallet-core-backup'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCloudBackupOverview } from '../useCloudBackupOverview'

// The counting rules live in the package; import the real one so this spec
// exercises what the screen actually renders.
vi.mock('@perawallet/wallet-core-backup', async () => ({
    useCloudBackupStore: vi.fn(),
    useBackupSyncStateStore: vi.fn(),
    deriveBackupSyncStatus: vi.fn(),
    backupIdToAddress: (v: string) => v.replace('did:pera:', ''),
    ...(await vi.importActual<
        typeof import('../../../../../../../../packages/backup/src/cloud/models/syncCounts')
    >('../../../../../../../../packages/backup/src/cloud/models/syncCounts')),
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: vi.fn(),
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    truncateAlgorandAddress: (v: string) => `truncated(${v})`,
}))
vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
}))
vi.mock('@modules/security', () => ({
    PinEditContent: () => null,
}))
vi.mock('../../../components/BackupCredentialsSheet', () => ({
    BackupCredentialsSheet: () => null,
}))
vi.mock('../../../components/TurnOffBackupSheet', () => ({
    TurnOffBackupSheet: () => null,
}))

const { disableBackupMock, removeBackupMock, syncNowMock } = vi.hoisted(() => ({
    disableBackupMock: vi.fn(),
    removeBackupMock: vi.fn(),
    syncNowMock: vi.fn(),
}))
vi.mock('../../../hooks', () => ({
    useDisableCloudBackup: () => ({
        disableBackup: disableBackupMock,
        isDisabling: false,
    }),
    useRemoveCloudBackup: () => ({
        removeBackup: removeBackupMock,
        isRemoving: false,
    }),
    useBackupSync: () => ({
        syncNow: syncNowMock,
        isSyncing: false,
    }),
}))

const mockCheckPinEnabled = vi.fn()
const mockRequestBottomSheet = vi.fn()

type SyncStateFixture = {
    backupId: string
    lastKnownBackupHash: null
    lastSyncedSeq: number
    lastSyncedAt: number | null
    lastSyncResult: 'SUCCESS' | 'FAILED' | null
    items: Record<
        string,
        {
            type: string
            status: string
            isDirty: boolean
            pendingDelete?: boolean
        }
    >
}

const emptySync = (): SyncStateFixture => ({
    backupId: 'did:pera:abc',
    lastKnownBackupHash: null,
    lastSyncedSeq: 0,
    lastSyncedAt: null,
    lastSyncResult: null,
    items: {},
})

const mockStores = (opts: {
    backupId: string | null
    syncState: SyncStateFixture | null
    accounts: number
    contacts: number
    derivedStatus?: string
}) => {
    ;(deriveBackupSyncStatus as unknown as Mock).mockReturnValue(
        opts.derivedStatus ?? 'upToDate',
    )
    ;(useCloudBackupStore as unknown as Mock).mockImplementation(
        (s: (st: { backupId: string | null }) => unknown) =>
            s({ backupId: opts.backupId }),
    )
    ;(useBackupSyncStateStore as unknown as Mock).mockImplementation(
        (s: (st: { syncState: unknown }) => unknown) =>
            s({ syncState: opts.syncState }),
    )
    ;(useAccountsStore as unknown as Mock).mockImplementation(
        (s: (st: { accounts: unknown[] }) => unknown) =>
            s({ accounts: new Array(opts.accounts).fill({}) }),
    )
    ;(useContactsStore as unknown as Mock).mockImplementation(
        (s: (st: { contacts: unknown[] }) => unknown) =>
            s({ contacts: new Array(opts.contacts).fill({}) }),
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    ;(usePinCode as unknown as Mock).mockReturnValue({
        checkPinEnabled: mockCheckPinEnabled,
    })
    ;(useBottomSheet as unknown as Mock).mockReturnValue({
        request: mockRequestBottomSheet,
    })
    mockCheckPinEnabled.mockResolvedValue(false)
    mockRequestBottomSheet.mockResolvedValue(undefined)
})

describe('useCloudBackupOverview', () => {
    test('maps upToDate to the success badge', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: emptySync(),
            accounts: 0,
            contacts: 0,
            derivedStatus: 'upToDate',
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.syncStatus).toBe('success')
    })

    test('maps error to the failed badge', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: emptySync(),
            accounts: 1,
            contacts: 0,
            derivedStatus: 'error',
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.syncStatus).toBe('failed')
    })

    test('counts: 0 in sync, all local accounts not backed up (empty sync state)', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: emptySync(),
            accounts: 2,
            contacts: 3,
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.accountsInSync).toBe(0)
        expect(result.current.accountsNotBackedUp).toBe(2)
        expect(result.current.contactsInSync).toBe(0)
        expect(result.current.contactsNotBackedUp).toBe(3)
    })

    test('counts ACTIVE items as in sync regardless of dirty, excludes IGNORED', () => {
        const syncState = emptySync()
        syncState.items = {
            // Dirty but still backed up (local edits not yet pushed).
            'accounts/A': { type: 'ACCOUNT', status: 'ACTIVE', isDirty: false },
            'accounts/B': { type: 'ACCOUNT', status: 'ACTIVE', isDirty: true },
            // IGNORED = not backed up.
            'accounts/C': {
                type: 'ACCOUNT',
                status: 'IGNORED',
                isDirty: false,
            },
        }
        mockStores({
            backupId: 'did:pera:abc',
            syncState,
            accounts: 3,
            contacts: 0,
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.accountsInSync).toBe(2)
        expect(result.current.accountsNotBackedUp).toBe(1)
    })

    test('a single backed-up account reads as one, not one per stored item', () => {
        const syncState = emptySync()
        syncState.items = {
            'accounts/A': { type: 'ACCOUNT', status: 'ACTIVE', isDirty: false },
            'secrets/A': { type: 'ACCOUNT', status: 'ACTIVE', isDirty: false },
        }
        mockStores({
            backupId: 'did:pera:abc',
            syncState,
            accounts: 1,
            contacts: 0,
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.accountsInSync).toBe(1)
        expect(result.current.accountsNotBackedUp).toBe(0)
    })

    test('strips the did:pera: prefix and truncates for the credential address label', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.credentialAddressLabel).toBe('truncated(abc)')
    })

    test('opens the turn off confirmation sheet when pressing turn off', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    test('asks for the PIN before turning off when a destructive choice is made', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet
            .mockResolvedValueOnce('turnOff') // turn off sheet choice
            .mockResolvedValueOnce(true) // PIN verification

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(mockCheckPinEnabled).toHaveBeenCalledTimes(1)
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
        expect(disableBackupMock).toHaveBeenCalledTimes(1)
    })

    test('removes the remote backup when the turn-off-and-remove choice is made', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet
            .mockResolvedValueOnce('turnOffAndRemove') // turn off sheet choice
            .mockResolvedValueOnce(true) // PIN verification

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(removeBackupMock).toHaveBeenCalledTimes(1)
        expect(disableBackupMock).not.toHaveBeenCalled()
    })

    test('does not ask for the PIN when the turn off sheet is dismissed', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValueOnce(undefined) // dismissed

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(mockCheckPinEnabled).not.toHaveBeenCalled()
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(disableBackupMock).not.toHaveBeenCalled()
    })

    test('opens the credentials sheet directly when no PIN is set', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        mockCheckPinEnabled.mockResolvedValue(false)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    test('asks for the PIN first and opens the credentials sheet when verified', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
    })

    test('does not open the credentials sheet when PIN verification fails', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: 0,
            contacts: 0,
        })
        mockCheckPinEnabled.mockResolvedValue(true)
        mockRequestBottomSheet.mockResolvedValueOnce(false)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })
})
