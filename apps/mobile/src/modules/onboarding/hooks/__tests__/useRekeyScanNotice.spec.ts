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

import { renderHook } from '@test-utils/render'
import { vi } from 'vitest'
import {
    useRekeyScanNotice,
    REKEY_SCAN_UNAVAILABLE,
} from '../useRekeyScanNotice'

const { mockShowToast, mockDiscoverRekeyedAccounts } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockDiscoverRekeyedAccounts: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountDiscovery: () => ({
        discoverRekeyedAccounts: mockDiscoverRekeyedAccounts,
    }),
}))

describe('useRekeyScanNotice', () => {
    it('returns the discovered accounts on success', async () => {
        mockDiscoverRekeyedAccounts.mockResolvedValue([{ address: 'A' }])
        const { result } = renderHook(() => useRekeyScanNotice())

        const scanned = await result.current.scanRekeyed(['SENDER'])

        expect(scanned).toEqual([{ address: 'A' }])
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('resolves to the sentinel instead of throwing when the scan fails', async () => {
        mockDiscoverRekeyedAccounts.mockRejectedValue(new Error('indexer 500'))
        const { result } = renderHook(() => useRekeyScanNotice())

        const scanned = await result.current.scanRekeyed(['SENDER'])

        expect(scanned).toBe(REKEY_SCAN_UNAVAILABLE)
    })

    it('shows the non-fatal notice, not the import-failed error, when the scan fails', async () => {
        mockDiscoverRekeyedAccounts.mockRejectedValue(new Error('indexer 500'))
        const { result } = renderHook(() => useRekeyScanNotice())

        await result.current.scanRekeyed(['SENDER'])

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'info',
                title: 'onboarding.searching_accounts.rekey_scan_failed_title',
                body: 'onboarding.searching_accounts.rekey_scan_failed_body',
            }),
        )
    })
})
