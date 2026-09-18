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
import { useRoute } from '@react-navigation/native'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCloudBackupOverview } from '../useCloudBackupOverview'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

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
vi.mock('../../../components/ConfirmTurnOffBackupSheet', () => ({
    ConfirmTurnOffBackupSheet: () => null,
}))

const {
    disableBackupMock,
    removeBackupMock,
    syncNowMock,
    showSyncQrMock,
    requirePinVerificationMock,
    markIntroductionSeenMock,
    useCloudBackupIntroductionMock,
    storeCredentialsMock,
    navigationMock,
} = vi.hoisted(() => ({
    disableBackupMock: vi.fn(),
    removeBackupMock: vi.fn(),
    syncNowMock: vi.fn(),
    showSyncQrMock: vi.fn(),
    requirePinVerificationMock: vi.fn(),
    markIntroductionSeenMock: vi.fn(),
    useCloudBackupIntroductionMock: vi.fn(),
    storeCredentialsMock: vi.fn(),
    // The global mock hands out fresh vi.fn()s per call, so nothing can be
    // asserted on it; this one is stable, like the real navigation object.
    navigationMock: {
        navigate: vi.fn(),
        push: vi.fn(),
        reset: vi.fn(),
        goBack: vi.fn(),
        setParams: vi.fn(),
        canGoBack: vi.fn(() => false),
        isFocused: vi.fn(() => true),
    },
}))
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => navigationMock,
    useRoute: vi.fn(() => ({ params: {} })),
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
    useCloudBackupIntroduction: useCloudBackupIntroductionMock,
    useStoreBackupCredentials: () => ({
        storeCredentials: storeCredentialsMock,
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
    ;(useRoute as unknown as Mock).mockReturnValue({ params: {} })
    ;(useBottomSheet as unknown as Mock).mockReturnValue({
        request: mockRequestBottomSheet,
    })
    requirePinVerificationMock.mockResolvedValue(true)
    showSyncQrMock.mockResolvedValue(undefined)
    mockRequestBottomSheet.mockResolvedValue(undefined)
    useCloudBackupIntroductionMock.mockReturnValue({
        isIntroductionSeen: true,
        markIntroductionSeen: markIntroductionSeenMock,
    })
    storeCredentialsMock.mockResolvedValue(undefined)
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

    test('tracks opening the accounts and contacts rows', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        const { result } = renderHook(() => useCloudBackupOverview())

        act(() => result.current.onPressAccounts())
        act(() => result.current.onPressContacts())

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.OverviewAccounts,
        )
        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.OverviewContacts,
        )
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

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.OverviewTurnOff,
        )
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    const confirmationSheetChoice = () =>
        mockRequestBottomSheet.mock.calls[1][0].contents.props.choice

    test('confirms the choice, then asks for the PIN, before turning off', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        mockRequestBottomSheet
            .mockResolvedValueOnce('turnOff')
            .mockResolvedValueOnce(true)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
        expect(confirmationSheetChoice()).toBe('turnOff')
        expect(mockRequestBottomSheet.mock.invocationCallOrder[1]).toBeLessThan(
            requirePinVerificationMock.mock.invocationCallOrder[0],
        )
        expect(disableBackupMock).toHaveBeenCalledTimes(1)
        expect(removeBackupMock).not.toHaveBeenCalled()
    })

    test('removes the remote backup once turning off and removing is confirmed', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        mockRequestBottomSheet
            .mockResolvedValueOnce('turnOffAndRemove')
            .mockResolvedValueOnce(true)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressTurnOff()

        expect(confirmationSheetChoice()).toBe('turnOffAndRemove')
        expect(requirePinVerificationMock).toHaveBeenCalledTimes(1)
        expect(removeBackupMock).toHaveBeenCalledTimes(1)
        expect(disableBackupMock).not.toHaveBeenCalled()
    })

    test.each(['turnOff', 'turnOffAndRemove'])(
        'does nothing when the %s confirmation is dismissed',
        async choice => {
            mockStores({
                backupId: 'did:pera:abc',
                syncState: null,
                accounts: [],
                contacts: [],
            })
            mockRequestBottomSheet
                .mockResolvedValueOnce(choice)
                .mockResolvedValueOnce(undefined)

            const { result } = renderHook(() => useCloudBackupOverview())
            await result.current.onPressTurnOff()

            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(2)
            expect(requirePinVerificationMock).not.toHaveBeenCalled()
            expect(disableBackupMock).not.toHaveBeenCalled()
            expect(removeBackupMock).not.toHaveBeenCalled()
        },
    )

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
        expect(removeBackupMock).not.toHaveBeenCalled()
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

    test('tracks the credential address tap but opens nothing when PIN verification fails', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        requirePinVerificationMock.mockResolvedValue(false)

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.OverviewCredentialAddress,
        )
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    test('hands off to the store flow when the credentials sheet resolves with store', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })
        mockRequestBottomSheet.mockResolvedValueOnce('store')

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(storeCredentialsMock).toHaveBeenCalledTimes(1)
        // This entry point took the PIN before opening the sheet, so the store
        // flow must not ask for it a second time.
        expect(storeCredentialsMock).toHaveBeenCalledWith({
            hasVerifiedPin: true,
        })
        expect(requirePinVerificationMock).toHaveBeenCalledTimes(1)
    })

    test('does not start the store flow when the credentials sheet is dismissed', async () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })

        const { result } = renderHook(() => useCloudBackupOverview())
        await result.current.onPressCredentialAddress()

        expect(storeCredentialsMock).not.toHaveBeenCalled()
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

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.OverviewSyncDevices,
        )
        expect(showSyncQrMock).toHaveBeenCalledTimes(1)
        expect(syncNowMock).not.toHaveBeenCalled()
    })

    test('marks the intro seen when viewing the overview with it unseen', () => {
        useCloudBackupIntroductionMock.mockReturnValue({
            isIntroductionSeen: false,
            markIntroductionSeen: markIntroductionSeenMock,
        })
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })

        renderHook(() => useCloudBackupOverview())

        expect(markIntroductionSeenMock).toHaveBeenCalledTimes(1)
    })

    test('does not mark the intro again when it is already seen', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })

        renderHook(() => useCloudBackupOverview())

        expect(markIntroductionSeenMock).not.toHaveBeenCalled()
    })

    describe('arriving from a freshly enabled backup', () => {
        beforeEach(() => {
            ;(useRoute as unknown as Mock).mockReturnValue({
                params: { shouldPromptStoreCredentials: true },
            })
            mockStores({
                backupId: 'did:pera:abc',
                syncState: null,
                accounts: [],
                contacts: [],
            })
        })

        test('offers to store the credentials without asking for the PIN again', () => {
            renderHook(() => useCloudBackupOverview())

            expect(storeCredentialsMock).toHaveBeenCalledWith({
                hasVerifiedPin: true,
            })
            expect(requirePinVerificationMock).not.toHaveBeenCalled()
        })

        test('offers once, however often the screen re-renders', () => {
            const { rerender } = renderHook(() => useCloudBackupOverview())

            rerender()
            rerender()

            expect(storeCredentialsMock).toHaveBeenCalledTimes(1)
        })

        // The param outlives this screen instance, so a remount of the stack
        // would reopen the sheet unless it is cleared.
        test('clears the param it acted on', () => {
            renderHook(() => useCloudBackupOverview())

            expect(navigationMock.setParams).toHaveBeenCalledWith({
                shouldPromptStoreCredentials: undefined,
            })
        })
    })

    test('offers nothing on a plain visit to the overview', () => {
        mockStores({
            backupId: 'did:pera:abc',
            syncState: null,
            accounts: [],
            contacts: [],
        })

        renderHook(() => useCloudBackupOverview())

        expect(storeCredentialsMock).not.toHaveBeenCalled()
        expect(navigationMock.setParams).not.toHaveBeenCalled()
    })
})
