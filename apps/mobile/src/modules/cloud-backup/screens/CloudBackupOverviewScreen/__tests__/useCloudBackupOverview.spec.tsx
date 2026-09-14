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
import { act, renderHook } from '@testing-library/react'
import {
    useCloudBackupStore,
    useBackupSyncStateStore,
    deriveBackupSyncStatus,
} from '@perawallet/wallet-core-backup'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCloudBackupOverview } from '../useCloudBackupOverview'

// The bucket rules live in the package; import the real ones so this spec
// exercises what the screen actually renders.
vi.mock('@perawallet/wallet-core-backup', async () => ({
    useCloudBackupStore: vi.fn(),
    useBackupSyncStateStore: vi.fn(),
    deriveBackupSyncStatus: vi.fn(),
    backupIdToAddress: (v: string) => v.replace('did:pera:', ''),
    ...(await vi.importActual<
        typeof import('../../../../../../../../packages/backup/src/cloud/models/reviewBuckets')
    >(
        '../../../../../../../../packages/backup/src/cloud/models/reviewBuckets',
    )),
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
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
}))
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinVerificationMock,
    }),
}))
vi.mock('../../../components/BackupCredentialsSheet', () => ({
    BackupCredentialsSheet: () => null,
}))
vi.mock('../../../components/TurnOffBackupSheet', () => ({
    TurnOffBackupSheet: () => null,
}))

const {
    disableBackupMock,
    removeBackupMock,
    syncNowMock,
    showSyncQrMock,
    requirePinVerificationMock,
} = vi.hoisted(() => ({
    disableBackupMock: vi.fn(),
    removeBackupMock: vi.fn(),
    syncNowMock: vi.fn(),
    showSyncQrMock: vi.fn(),
    requirePinVerificationMock: vi.fn(),
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
    useSyncDevicesQr: () => ({
        showSyncQr: showSyncQrMock,
    }),
}))

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
            knownVer: number
            pendingDelete?: boolean
        }
    >
}

/** `knownVer > 0` is what marks an item as actually uploaded, so the fixtures
 *  have to carry it to read as backed up. */
const uploaded = (
    over: Partial<SyncStateFixture['items'][string]> = {},
): SyncStateFixture['items'][string] => ({
    type: 'ACCOUNT',
    status: 'ACTIVE',
    isDirty: false,
    knownVer: 1,
    ...over,
})

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
    accounts: string[]
    contacts: string[]
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
            s({ accounts: opts.accounts.map(address => ({ address })) }),
    )
    ;(useContactsStore as unknown as Mock).mockImplementation(
        (s: (st: { contacts: unknown[] }) => unknown) =>
            s({ contacts: opts.contacts.map(address => ({ address })) }),
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheet as unknown as Mock).mockReturnValue({
        request: mockRequestBottomSheet,
    })
    requirePinVerificationMock.mockResolvedValue(true)
    showSyncQrMock.mockResolvedValue(undefined)
    mockRequestBottomSheet.mockResolvedValue(undefined)
})

describe('useCloudBackupOverview', () => {
    const badgeCases: [string, string | null][] = [
        ['idle', null],
        ['pending', null],
        ['syncing', 'syncing'],
        ['upToDate', 'success'],
        ['error', 'failed'],
    ]

    test.each(badgeCases)('maps the %s status to %s', (status, badge) => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: emptySync(),
            accounts: ['A'],
            contacts: [],
            derivedStatus: status,
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.syncStatus).toBe(badge)
    })

    test('counts: 0 in sync, all local accounts not backed up (empty sync state)', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: emptySync(),
            accounts: ['A', 'B'],
            contacts: ['C1', 'C2', 'C3'],
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
            'accounts/A': uploaded(),
            'accounts/B': uploaded({ isDirty: true }),
            // IGNORED = not backed up.
            'accounts/C': uploaded({ status: 'IGNORED' }),
        }
        mockStores({
            backupId: 'did:pera:abc',
            syncState,
            accounts: ['A', 'B', 'C'],
            contacts: [],
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.accountsInSync).toBe(2)
        expect(result.current.accountsNotBackedUp).toBe(1)
    })

    test('an account tracked but never uploaded is not in sync', () => {
        const syncState = emptySync()
        // What reconcile writes for a brand-new local account, before any push.
        syncState.items = {
            'accounts/A': uploaded({ knownVer: 0, isDirty: true }),
        }
        mockStores({
            backupId: 'did:pera:abc',
            syncState,
            accounts: ['A'],
            contacts: [],
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.accountsInSync).toBe(0)
        expect(result.current.accountsNotBackedUp).toBe(1)
    })

    test('counts a backed-up contact in sync and a local-only one as not backed up', () => {
        const syncState = emptySync()
        syncState.items = {
            'contacts/C1': uploaded({ type: 'CONTACT' }),
        }
        mockStores({
            backupId: 'did:pera:abc',
            syncState,
            accounts: [],
            contacts: ['C1', 'C2'],
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.contactsInSync).toBe(1)
        expect(result.current.contactsNotBackedUp).toBe(1)
    })

    test('a single backed-up account reads as one, not one per stored item', () => {
        const syncState = emptySync()
        syncState.items = {
            'accounts/A': uploaded(),
            'secrets/A': uploaded(),
        }
        mockStores({
            backupId: 'did:pera:abc',
            syncState,
            accounts: ['A'],
            contacts: [],
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.accountsInSync).toBe(1)
        expect(result.current.accountsNotBackedUp).toBe(0)
    })

    test('strips the did:pera: prefix and truncates for the credential address label', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        const { result } = renderHook(() => useCloudBackupOverview())
        expect(result.current.credentialAddressLabel).toBe('truncated(abc)')
    })

    test('opens the turn off confirmation sheet when pressing turn off', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    test('asks for the PIN before turning off when a destructive choice is made', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        mockRequestBottomSheet.mockResolvedValueOnce('turnOff')

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(requirePinVerificationMock).toHaveBeenCalledTimes(1)
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(disableBackupMock).toHaveBeenCalledTimes(1)
    })

    test('removes the remote backup when the turn-off-and-remove choice is made', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        mockRequestBottomSheet.mockResolvedValueOnce('turnOffAndRemove')

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(removeBackupMock).toHaveBeenCalledTimes(1)
        expect(disableBackupMock).not.toHaveBeenCalled()
    })

    test('does not ask for the PIN when the turn off sheet is dismissed', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        mockRequestBottomSheet.mockResolvedValueOnce(undefined) // dismissed

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(requirePinVerificationMock).not.toHaveBeenCalled()
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(disableBackupMock).not.toHaveBeenCalled()
    })

    test('opens the credentials sheet directly when no PIN is set', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        // The gate resolves true with no sheet of its own when no PIN is set.
        requirePinVerificationMock.mockResolvedValue(true)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    test('asks for the PIN first and opens the credentials sheet when verified', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        requirePinVerificationMock.mockResolvedValue(true)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(
            requirePinVerificationMock.mock.invocationCallOrder[0],
        ).toBeLessThan(mockRequestBottomSheet.mock.invocationCallOrder[0])
    })

    test('does not open the credentials sheet when PIN verification fails', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        requirePinVerificationMock.mockResolvedValue(false)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    test('opens the sync QR flow instead of forcing a sync', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })

        const { result } = renderHook(() => useCloudBackupOverview())

        await act(() => result.current.onPressSyncDevices())

        expect(showSyncQrMock).toHaveBeenCalledTimes(1)
        expect(syncNowMock).not.toHaveBeenCalled()
    })
})
