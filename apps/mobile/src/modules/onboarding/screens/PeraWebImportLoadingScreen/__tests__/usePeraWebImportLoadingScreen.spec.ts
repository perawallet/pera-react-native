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

import { act, renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AppState } from 'react-native'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks'
import { usePeraWebImportLoadingScreen } from '../usePeraWebImportLoadingScreen'

const mockGoBack = vi.fn()
const mockReplace = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

const mockErrorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
    }),
}))

vi.mock('@hooks/useLanguage')

const mockFetchPeraWebBackup = vi.fn()
const mockDecryptPeraWebBackupPayload = vi.fn()
const mockImportAccount = vi.fn()

vi.mock('@perawallet/wallet-core-backup', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-backup',
    )
    return {
        ...actual,
        fetchPeraWebBackup: (...args: unknown[]) =>
            mockFetchPeraWebBackup(...args),
        decryptPeraWebBackupPayload: (...args: unknown[]) =>
            mockDecryptPeraWebBackupPayload(...args),
        usePeraWebAccountImport: () => ({
            importAccount: mockImportAccount,
        }),
    }
})

const encryptionKey = new Uint8Array(32).fill(1)
const accountFromBackup = (address: string) => ({
    address,
    name: 'Savings',
    accountType: null,
    privateKey: new Uint8Array(32).fill(2),
    metadata: null,
})

describe('usePeraWebImportLoadingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRemoteConfigStore.getState().resetState()
        usePeraWebImportFlowStore.getState().reset()
        usePeraWebImportFlowStore.getState().setQr({
            backupId: 'backup-1',
            encryptionKey,
        })
        mockDecryptPeraWebBackupPayload.mockReturnValue({ accounts: [] })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('does not fetch the backup and surfaces the network-unavailable reason while peraWebImport is off', async () => {
        setCapabilityOverrides({ peraWebImport: false })

        renderHook(() => usePeraWebImportLoadingScreen())

        await waitFor(() => {
            expect(mockGoBack).toHaveBeenCalledTimes(1)
        })

        expect(mockFetchPeraWebBackup).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.network_unavailable.title',
            'common.network_unavailable.generic_body',
        )
    })

    it('still fetches the backup on mainnet (happy path unaffected)', async () => {
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })

        renderHook(() => usePeraWebImportLoadingScreen())

        await waitFor(() => {
            expect(mockFetchPeraWebBackup).toHaveBeenCalledWith(
                'live',
                'backup-1',
            )
        })
    })

    it("decrypts through the legacy chain's backup adapter", async () => {
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })

        renderHook(() => usePeraWebImportLoadingScreen())

        await waitFor(() => {
            expect(mockDecryptPeraWebBackupPayload).toHaveBeenCalled()
        })
        expect(mockDecryptPeraWebBackupPayload.mock.calls[0]?.[2]).toBe(
            ALGORAND_CHAIN_ID,
        )
    })

    it('lists the decrypted accounts and imports nothing until the user confirms', async () => {
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })
        mockDecryptPeraWebBackupPayload.mockReturnValue({
            accounts: [
                {
                    address: 'ADDRESS_A',
                    name: 'Savings',
                    accountType: null,
                    privateKey: new Uint8Array(32).fill(2),
                    metadata: null,
                },
            ],
        })
        mockImportAccount.mockResolvedValue(undefined)

        const { result } = renderHook(() => usePeraWebImportLoadingScreen())

        await waitFor(() => {
            expect(result.current.reviewAccounts).toEqual([
                { address: 'ADDRESS_A', name: 'Savings' },
            ])
        })
        expect(mockImportAccount).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()

        act(() => {
            result.current.handleConfirm()
            result.current.handleConfirm()
        })

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('PeraWebImportResult', {
                importedCount: 1,
                skippedDuplicateCount: 0,
                failedCount: 0,
            })
        })
        expect(mockImportAccount).toHaveBeenCalledTimes(1)
    })

    it('leaves without importing and wipes the staged key on Cancel', async () => {
        const account = accountFromBackup('ADDRESS_A')
        const seed = account.privateKey
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })
        mockDecryptPeraWebBackupPayload.mockReturnValue({ accounts: [account] })
        const { result } = renderHook(() => usePeraWebImportLoadingScreen())
        await waitFor(() =>
            expect(result.current.reviewAccounts).toHaveLength(1),
        )

        act(() => result.current.handleCancel())

        expect(seed).toEqual(new Uint8Array(32))
        expect(result.current.reviewAccounts).toBeNull()
        expect(mockImportAccount).not.toHaveBeenCalled()
        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    const captureAppStateChange = () => {
        const subscription = vi.spyOn(AppState, 'addEventListener')
        return () => {
            const onChange = subscription.mock.calls.find(
                ([event]) => event === 'change',
            )?.[1]
            if (!onChange) throw new Error('Missing import AppState listener')
            return onChange
        }
    }

    it('clears the review on backgrounding before Confirm and goes back once active', async () => {
        const appStateChange = captureAppStateChange()
        const account = accountFromBackup('ADDRESS_A')
        const seed = account.privateKey
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })
        mockDecryptPeraWebBackupPayload.mockReturnValue({ accounts: [account] })
        const { result } = renderHook(() => usePeraWebImportLoadingScreen())
        await waitFor(() =>
            expect(result.current.reviewAccounts).toHaveLength(1),
        )
        const onChange = appStateChange()

        act(() => {
            onChange('background')
            result.current.handleConfirm()
        })

        expect(result.current.reviewAccounts).toBeNull()
        expect(seed).toEqual(new Uint8Array(32))
        expect(mockImportAccount).not.toHaveBeenCalled()
        expect(mockGoBack).not.toHaveBeenCalled()

        act(() => onChange('active'))

        expect(mockGoBack).toHaveBeenCalledTimes(1)
        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.error.title',
            'onboarding.pera_web_import.review.interrupted',
        )
    })

    it('reports a partial import when backgrounded after Confirm, counting the wiped rows as failed', async () => {
        const appStateChange = captureAppStateChange()
        const first = accountFromBackup('ADDRESS_A')
        const second = accountFromBackup('ADDRESS_B')
        const unusedSeed = second.privateKey
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })
        mockDecryptPeraWebBackupPayload.mockReturnValue({
            accounts: [first, second],
        })
        let finishImport = () => {}
        mockImportAccount.mockImplementationOnce(
            () =>
                new Promise<void>(resolve => {
                    finishImport = resolve
                }),
        )
        const { result } = renderHook(() => usePeraWebImportLoadingScreen())
        await waitFor(() =>
            expect(result.current.reviewAccounts).toHaveLength(2),
        )
        act(() => result.current.handleConfirm())
        const onChange = appStateChange()

        act(() => onChange('background'))
        await act(async () => finishImport())

        expect(unusedSeed).toEqual(new Uint8Array(32))
        expect(mockImportAccount).toHaveBeenCalledTimes(1)
        expect(mockReplace).toHaveBeenCalledWith('PeraWebImportResult', {
            importedCount: 1,
            skippedDuplicateCount: 0,
            failedCount: 1,
        })

        act(() => onChange('active'))

        expect(mockGoBack).not.toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
    })
})
