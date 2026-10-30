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

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// The default driver mock has no migration or key-value surface, so every wipe
// step that reaches them would log a failure; the in-memory driver implements them.
vi.unmock('@perawallet/wallet-extension-platform-driver')
vi.unmock('@perawallet/wallet-extension-platform')

import { createQueryClientWrapper } from '@test-utils/render'
import {
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { useDeleteAllData } from '@hooks/useDeleteAllData'
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

describe('delete-all-data', () => {
    beforeAll(async () => {
        await setupTestDatabase()
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
})
