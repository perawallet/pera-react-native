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
    useDelegationScanNoticeResult,
    REKEY_SCAN_UNAVAILABLE,
} from '../useDelegationScanNoticeResult'

const { mockShowToast, mockDiscoverDelegatedAccounts } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockDiscoverDelegatedAccounts: vi.fn(),
}))

vi.mock('@hooks/useLanguage')

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
        discoverDelegatedAccounts: mockDiscoverDelegatedAccounts,
    }),
}))

describe('useDelegationScanNoticeResult', () => {
    it('returns the discovered accounts on success', async () => {
        mockDiscoverDelegatedAccounts.mockResolvedValue([{ address: 'A' }])
        const { result } = renderHook(() => useDelegationScanNoticeResult())

        const scanned = await result.current.scanRekeyed(['SENDER'])

        expect(scanned).toEqual([{ address: 'A' }])
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    it('resolves to the sentinel instead of throwing when the scan fails', async () => {
        mockDiscoverDelegatedAccounts.mockRejectedValue(
            new Error('indexer 500'),
        )
        const { result } = renderHook(() => useDelegationScanNoticeResult())

        const scanned = await result.current.scanRekeyed(['SENDER'])

        expect(scanned).toBe(REKEY_SCAN_UNAVAILABLE)
    })

    it('shows the non-fatal notice, not the import-failed error, when the scan fails', async () => {
        mockDiscoverDelegatedAccounts.mockRejectedValue(
            new Error('indexer 500'),
        )
        const { result } = renderHook(() => useDelegationScanNoticeResult())

        await result.current.scanRekeyed(['SENDER'])

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'info',
                title: 'onboarding.searching_accounts.rekey_scan_failed_title',
                body: 'onboarding.searching_accounts.rekey_scan_failed_body',
            }),
        )
    })

    it('words the notice for a rescan the user started', async () => {
        mockDiscoverDelegatedAccounts.mockRejectedValue(
            new Error('indexer 500'),
        )
        const { result } = renderHook(() => useDelegationScanNoticeResult())

        await result.current.scanRekeyed(['SENDER'], 'rescan')

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'onboarding.searching_accounts.rekey_scan_failed_title',
                body: 'onboarding.searching_accounts.rekey_rescan_failed_body',
            }),
        )
    })

    it("lists each account's address on the scan chain and skips one without", () => {
        const { result } = renderHook(() => useDelegationScanNoticeResult())

        const addresses = result.current.rekeyScanAddressesOf([
            { chains: { algorand: { address: 'ALGO_1' } } },
            { chains: { ethereum: { address: '0xabc' } } },
            { chains: { algorand: { address: 'ALGO_2' } } },
        ] as never)

        expect(addresses).toEqual(['ALGO_1', 'ALGO_2'])
    })

    it('drops candidates whose scan-chain address a held account already has', () => {
        const { result } = renderHook(() => useDelegationScanNoticeResult())
        const held = { chains: { algorand: { address: 'HELD' } } }
        const fresh = { chains: { algorand: { address: 'FRESH' } } }

        const unheld = result.current.withoutHeld(
            [{ chains: { algorand: { address: 'HELD' } } }, fresh] as never,
            [held] as never,
        )

        expect(unheld).toEqual([fresh])
    })
})
