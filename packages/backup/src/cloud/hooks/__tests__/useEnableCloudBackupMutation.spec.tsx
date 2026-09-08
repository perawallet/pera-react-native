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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const SALT = 'c2FsdA=='

const {
    MNEMONIC,
    MNEMONIC_INDICES,
    enableCloudBackupMock,
    setConfiguredMock,
    clearDraftMock,
    draftState,
} = vi.hoisted(() => ({
    MNEMONIC: ['abandon', 'ability', 'able'],
    MNEMONIC_INDICES: Uint16Array.from([0, 1, 2]),
    enableCloudBackupMock: vi.fn(),
    setConfiguredMock: vi.fn(),
    clearDraftMock: vi.fn(),
    draftState: {
        mnemonicIndices: null as Uint16Array | null,
        salt: null as string | null,
    },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    mnemonicIndexToWord: (index: number) => MNEMONIC[index],
}))

vi.mock('../../credentials/enableCloudBackup', () => ({
    enableCloudBackup: enableCloudBackupMock,
}))

vi.mock('../../store/draftStore', () => ({
    useCloudBackupDraftStore: (
        selector: (s: {
            mnemonicIndices: Uint16Array | null
            salt: string | null
            clearDraft: () => void
        }) => unknown,
    ) =>
        selector({
            mnemonicIndices: draftState.mnemonicIndices,
            salt: draftState.salt,
            clearDraft: clearDraftMock,
        }),
}))

vi.mock('../../store/store', () => ({
    useCloudBackupStore: (
        selector: (s: {
            setConfigured: (params: { backupId: string; salt: string }) => void
        }) => unknown,
    ) => selector({ setConfigured: setConfiguredMock }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-123',
}))

import { useEnableCloudBackupMutation } from '../useEnableCloudBackupMutation'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    draftState.mnemonicIndices = MNEMONIC_INDICES
    draftState.salt = SALT
})

describe('useEnableCloudBackupMutation', () => {
    test('registers the drafted credentials and promotes them to the store', async () => {
        enableCloudBackupMock.mockResolvedValue({ backupId: 'did:pera:abc' })

        const { result } = renderHook(() => useEnableCloudBackupMutation(), {
            wrapper: createWrapper(),
        })

        act(() => result.current.mutate())

        await waitFor(() => expect(setConfiguredMock).toHaveBeenCalled())
        expect(enableCloudBackupMock).toHaveBeenCalledWith({
            mnemonic: MNEMONIC,
            salt: SALT,
            deviceId: 'device-123',
            network: 'mainnet',
        })
        expect(setConfiguredMock).toHaveBeenCalledWith({
            backupId: 'did:pera:abc',
            salt: SALT,
        })
        expect(clearDraftMock).toHaveBeenCalled()
    })

    test('still records the backup when the draft is cleared mid-flight', async () => {
        let resolveEnable!: (value: { backupId: string }) => void
        enableCloudBackupMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveEnable = resolve
                }),
        )

        const { result, rerender } = renderHook(
            () => useEnableCloudBackupMutation(),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())
        await waitFor(() => expect(enableCloudBackupMock).toHaveBeenCalled())

        draftState.mnemonicIndices = null
        draftState.salt = null
        rerender()

        await act(async () => resolveEnable({ backupId: 'did:pera:abc' }))

        // The salt is pinned to the attempt: the backup exists server-side
        // under it whatever the draft holds by now.
        await waitFor(() =>
            expect(setConfiguredMock).toHaveBeenCalledWith({
                backupId: 'did:pera:abc',
                salt: SALT,
            }),
        )
    })

    test('rejects without a request when the draft is already gone', async () => {
        draftState.mnemonicIndices = null
        draftState.salt = null
        const onError = vi.fn()

        const { result } = renderHook(
            () => useEnableCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(enableCloudBackupMock).not.toHaveBeenCalled()
        expect(setConfiguredMock).not.toHaveBeenCalled()
    })

    test('leaves the store unconfigured when registration fails', async () => {
        enableCloudBackupMock.mockRejectedValue(new Error('network down'))
        const onError = vi.fn()

        const { result } = renderHook(
            () => useEnableCloudBackupMutation({ onError }),
            { wrapper: createWrapper() },
        )

        act(() => result.current.mutate())

        await waitFor(() => expect(onError).toHaveBeenCalled())
        expect(setConfiguredMock).not.toHaveBeenCalled()
        expect(clearDraftMock).not.toHaveBeenCalled()
    })
})
