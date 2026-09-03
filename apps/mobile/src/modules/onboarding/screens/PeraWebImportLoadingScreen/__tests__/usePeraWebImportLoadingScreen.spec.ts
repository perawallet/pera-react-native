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

import { renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-config'
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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

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

describe('usePeraWebImportLoadingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        usePeraWebImportFlowStore.getState().reset()
        usePeraWebImportFlowStore.getState().setQr({
            backupId: 'backup-1',
            encryptionKey,
        })
        vi.mocked(useNetwork).mockReturnValue({
            network: Networks.mainnet,
        } as ReturnType<typeof useNetwork>)
        mockDecryptPeraWebBackupPayload.mockReturnValue({ accounts: [] })
    })

    it.each([Networks.betanet, Networks.custom])(
        'does not fetch the backup and surfaces the network-unavailable reason on %s',
        async network => {
            vi.mocked(useNetwork).mockReturnValue({
                network,
            } as ReturnType<typeof useNetwork>)

            renderHook(() => usePeraWebImportLoadingScreen())

            await waitFor(() => {
                expect(mockGoBack).toHaveBeenCalledTimes(1)
            })

            expect(mockFetchPeraWebBackup).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalledWith(
                'common.network_unavailable.title',
                'common.network_unavailable.body',
            )
        },
    )

    it('still fetches the backup on mainnet (happy path unaffected)', async () => {
        mockFetchPeraWebBackup.mockResolvedValue({ encryptedContent: 'x' })

        renderHook(() => usePeraWebImportLoadingScreen())

        await waitFor(() => {
            expect(mockFetchPeraWebBackup).toHaveBeenCalledWith(
                Networks.mainnet,
                'backup-1',
            )
        })
    })
})
