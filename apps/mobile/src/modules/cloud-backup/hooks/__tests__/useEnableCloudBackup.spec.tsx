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
import { useEnableCloudBackup } from '../useEnableCloudBackup'

const SALT = 'c2FsdA=='

const {
    MNEMONIC,
    MNEMONIC_INDICES,
    enableCloudBackupMock,
    setConfiguredMock,
    clearDraftMock,
    showToastMock,
    resetMock,
    draftState,
} = vi.hoisted(() => ({
    MNEMONIC: ['abandon', 'ability', 'able'],
    MNEMONIC_INDICES: Uint16Array.from([0, 1, 2]),
    enableCloudBackupMock: vi.fn(),
    setConfiguredMock: vi.fn(),
    clearDraftMock: vi.fn(),
    showToastMock: vi.fn(),
    resetMock: vi.fn(),
    draftState: {
        mnemonicIndices: null as Uint16Array | null,
        salt: null as string | null,
    },
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ reset: resetMock }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    mnemonicIndexToWord: (index: number) => MNEMONIC[index],
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    enableCloudBackup: enableCloudBackupMock,
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
    useCloudBackupStore: (
        selector: (s: {
            setConfigured: (params: {
                backupId: string
                salt: string
                deviceId: string
            }) => void
        }) => unknown,
    ) => selector({ setConfigured: setConfiguredMock }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-123',
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

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

describe('useEnableCloudBackup', () => {
    test('derives, registers, and persists the configured backup on success', async () => {
        enableCloudBackupMock.mockResolvedValue({ backupId: 'did:pera:abc' })

        const { result } = renderHook(() => useEnableCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.enableBackup()
        })

        await waitFor(() => expect(enableCloudBackupMock).toHaveBeenCalled())

        expect(enableCloudBackupMock).toHaveBeenCalledWith({
            mnemonic: MNEMONIC,
            salt: SALT,
            deviceId: 'device-123',
            network: 'mainnet',
        })
        await waitFor(() =>
            expect(setConfiguredMock).toHaveBeenCalledWith({
                backupId: 'did:pera:abc',
                salt: SALT,
                deviceId: 'device-123',
            }),
        )
        expect(clearDraftMock).toHaveBeenCalled()
        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.enable.success',
                type: 'success',
            }),
        )
        await waitFor(() =>
            expect(resetMock).toHaveBeenCalledWith({
                index: 0,
                routes: [{ name: 'CloudBackupOverview' }],
            }),
        )
    })

    test('completes the success UX when the draft is cleared mid-flight', async () => {
        let resolveEnable!: (value: { backupId: string }) => void
        enableCloudBackupMock.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveEnable = resolve
                }),
        )

        const { result, rerender } = renderHook(() => useEnableCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.enableBackup()
        })
        await waitFor(() => expect(enableCloudBackupMock).toHaveBeenCalled())

        draftState.mnemonicIndices = null
        draftState.salt = null
        rerender()

        await act(async () => {
            resolveEnable({ backupId: 'did:pera:abc' })
        })

        await waitFor(() =>
            expect(setConfiguredMock).toHaveBeenCalledWith({
                backupId: 'did:pera:abc',
                salt: SALT,
                deviceId: 'device-123',
            }),
        )
        expect(showToastMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'cloud_backup.enable.success',
                type: 'success',
            }),
        )
        expect(resetMock).toHaveBeenCalledWith({
            index: 0,
            routes: [{ name: 'CloudBackupOverview' }],
        })
    })

    test('shows an error toast when the draft is already gone at press time', async () => {
        draftState.mnemonicIndices = null
        draftState.salt = null

        const { result } = renderHook(() => useEnableCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.enableBackup()
        })

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'cloud_backup.enable.error',
                    type: 'error',
                }),
            ),
        )
        expect(enableCloudBackupMock).not.toHaveBeenCalled()
        expect(setConfiguredMock).not.toHaveBeenCalled()
    })

    test('shows an error toast and leaves state unconfigured on failure', async () => {
        enableCloudBackupMock.mockRejectedValue(new Error('network down'))

        const { result } = renderHook(() => useEnableCloudBackup(), {
            wrapper: createWrapper(),
        })

        act(() => {
            result.current.enableBackup()
        })

        await waitFor(() =>
            expect(showToastMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'cloud_backup.enable.error',
                    type: 'error',
                }),
            ),
        )
        expect(setConfiguredMock).not.toHaveBeenCalled()
        expect(resetMock).not.toHaveBeenCalled()
    })
})
