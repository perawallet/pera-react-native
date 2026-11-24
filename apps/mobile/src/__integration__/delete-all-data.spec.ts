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

// Runs the real useDeleteAllData against the real store registry, so a store
// that never joined the registry keeps its state here exactly as it would in the app.

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// The default driver mock has no migration or key-value surface, so every wipe
// step that reaches them would log a failure; the in-memory driver implements them.
vi.unmock('@perawallet/wallet-extension-platform-driver')
vi.unmock('@perawallet/wallet-extension-platform')

import {
    rehydrateAccountsStore,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { usePinCode } from '@perawallet/wallet-core-security'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { createQueryClientWrapper } from '@test-utils/render'
import {
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { readPendingWipe, useDeleteAllData } from '@hooks/useDeleteAllData'
import { useAutoLockListener } from '@modules/security/components/AutoLockGuard/useAutoLockListener'
import { useDuressWipe } from '@modules/security/hooks/useDuressWipe'
import { SecureBackupAccountKind } from '@perawallet/wallet-core-backup'
import { useUndeliveredSignRequestsStore } from '@perawallet/wallet-core-multisig'
import { useCameraTabResultStore } from '@components/CameraTabResult/useCameraTabResultStore'
import { useAssetListViewStore } from '@modules/accounts/hooks/useAssetListViewStore'
import { useBottomSheetStore } from '@modules/bottom-sheet/store/bottomSheetStore'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks/asbImportFlowStore'
import { useWebViewStore } from '@modules/webview/hooks/useWebViewStore'

const wipe = async () => {
    const { result } = renderHook(() => useDeleteAllData(), {
        wrapper: createQueryClientWrapper(),
    })
    await act(() => result.current.deleteAllData())
}

const REAL_ACCOUNT_ID = 'real-account'
const ACCOUNT_STORAGE_KEY = 'accounts-store'

describe('delete-all-data', () => {
    beforeAll(async () => {
        await setupTestDatabase()
        await rehydrateAccountsStore()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    it('Given an ASB import abandoned after decryption, when delete-all-data runs, then the decrypted key is zeroed and the import state is gone', async () => {
        const privateKey = new Uint8Array(64).fill(7)
        useAsbImportFlowStore.getState().setPayload({
            accounts: [
                {
                    address: 'ASB_IMPORT_ADDRESS',
                    name: null,
                    kind: SecureBackupAccountKind.Single,
                    privateKey,
                },
            ],
            providerName: null,
            deviceId: null,
        })

        await wipe()

        const state = useAsbImportFlowStore.getState()
        expect(state.payload).toBeNull()
        expect(state.selectedAddresses).toEqual([])
        expect(privateKey.every(byte => byte === 0)).toBe(true)
    })

    it('Given UI state left by the previous wallet, when delete-all-data runs, then each store is back to its initial state', async () => {
        useCameraTabResultStore.getState().showResult('account-imported')
        useAssetListViewStore.getState().toggleGroupExpanded('group-1')
        useWebViewStore.getState().pushWebView({ url: 'https://example.com' })
        useUndeliveredSignRequestsStore.getState().markUndelivered('sr-1')

        await wipe()

        expect(useCameraTabResultStore.getState().result).toBeNull()
        expect(useAssetListViewStore.getState().expandedGroupIds).toEqual([])
        expect(useWebViewStore.getState().openWebViews).toEqual([])
        expect(
            useUndeliveredSignRequestsStore.getState().signRequestIds,
        ).toEqual([])
    })

    it('Given a mounted sheet host, when delete-all-data runs, then the host stays registered so the delete-success sheet can present', async () => {
        useBottomSheetStore.getState().registerBottomSheetHost()

        await wipe()

        expect(useBottomSheetStore.getState().hostCount).toBe(1)
    })

    it('Given a wipe the process died in after the keystore went, when the app relaunches, then the wipe finishes before the lock check and no account is left', async () => {
        useAccountsStore.getState().setAccounts([
            {
                id: REAL_ACCOUNT_ID,
                name: 'Savings',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'REAL_ACCOUNT_ADDRESS' } },
            },
        ])
        const passkeyAutofill = getProvider().passkeyAutofill
        const stall = vi
            .spyOn(passkeyAutofill, 'clearCredentials')
            .mockReturnValueOnce(new Promise<void>(() => {}))
        const { result: interrupted, unmount } = renderHook(
            () => useDeleteAllData(),
            { wrapper: createQueryClientWrapper() },
        )
        void interrupted.current.deleteAllData()
        await waitFor(() => expect(stall).toHaveBeenCalled())
        unmount()

        expect(readPendingWipe()).toBe('delete-all')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)

        const { result: relaunched } = renderHook(() => useAutoLockListener(), {
            wrapper: createQueryClientWrapper(),
        })
        await waitFor(() => expect(relaunched.current.isChecking).toBe(false))

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(
            getProvider().keyValueStorage.getItem(ACCOUNT_STORAGE_KEY) ?? '',
        ).not.toContain(REAL_ACCOUNT_ID)
        expect(readPendingWipe()).toBeNull()
        expect(relaunched.current.isLocked).toBe(false)
    })

    it('Given an interrupted duress wipe, when a fresh guard starts with rehydrated accounts, then it completes the wipe and persists only the decoy', async () => {
        const storage = getProvider().keyValueStorage
        useAccountsStore.getState().setAccounts([
            {
                id: REAL_ACCOUNT_ID,
                name: 'Savings',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'REAL_ACCOUNT_ADDRESS' } },
            },
        ])
        const accountsBeforeWipe = storage.getItem(ACCOUNT_STORAGE_KEY)
        expect(accountsBeforeWipe).toContain(REAL_ACCOUNT_ID)

        const { result: pin } = renderHook(() => usePinCode())
        await act(() => pin.current.savePin('123456'))
        await expect(pin.current.checkPinEnabled()).resolves.toBe(true)

        const stall = vi
            .spyOn(getProvider().passkeyAutofill, 'clearCredentials')
            .mockReturnValueOnce(new Promise<void>(() => {}))
        const { result: interrupted, unmount } = renderHook(
            () => useDuressWipe(),
            { wrapper: createQueryClientWrapper() },
        )
        void interrupted.current.performDuressWipe()
        await waitFor(() => expect(stall).toHaveBeenCalledTimes(1))
        unmount()

        expect(readPendingWipe()).toBe('duress')
        await expect(pin.current.checkPinEnabled()).resolves.toBe(false)

        useAccountsStore.getState().resetState()
        storage.setItem(ACCOUNT_STORAGE_KEY, accountsBeforeWipe!)
        await rehydrateAccountsStore()
        expect(useAccountsStore.getState().accounts[0]?.id).toBe(
            REAL_ACCOUNT_ID,
        )

        const { result: relaunched } = renderHook(() => useAutoLockListener(), {
            wrapper: createQueryClientWrapper(),
        })
        await waitFor(() => expect(relaunched.current.isChecking).toBe(false))

        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toHaveLength(1)
        expect(accounts[0].id).not.toBe(REAL_ACCOUNT_ID)
        expect(accounts[0].custody).toMatchObject({
            kind: 'local',
            seed: 'bip39',
        })
        const persisted = storage.getItem(ACCOUNT_STORAGE_KEY) ?? ''
        expect(persisted).toContain(accounts[0].id)
        expect(persisted).not.toContain(REAL_ACCOUNT_ID)
        expect(readPendingWipe()).toBeNull()
        expect(relaunched.current.isLocked).toBe(false)
    })
})
