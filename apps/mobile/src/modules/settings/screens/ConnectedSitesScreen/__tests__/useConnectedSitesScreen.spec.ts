/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useConnectedSitesScreen } from '../useConnectedSitesScreen'
import { useDappConnectionsStore } from '@modules/settings/hooks/useDappConnectionsStore'
import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'

const mockRequestBottomSheet = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/settings/hooks/useDappConnectionsStore', () => ({
    useDappConnectionsStore: vi.fn(),
}))

const site: DappPermission = {
    origin: 'https://example.com',
    addresses: ['ADDR_A'],
    grantedAt: 1000,
}

describe('useConnectedSitesScreen', () => {
    const mockRevoke = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        vi.clearAllMocks()
        mockRevoke.mockResolvedValue(undefined)
        ;(useDappConnectionsStore as Mock).mockReturnValue({
            sites: [site],
            isLoading: false,
            refetch: vi.fn(),
            revoke: mockRevoke,
        })
    })

    it('exposes sites, isLoading, and a stable keyExtractor', () => {
        const { result } = renderHook(() => useConnectedSitesScreen())

        expect(result.current.sites).toEqual([site])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.keyExtractor(site)).toBe('https://example.com')
    })

    it('confirms via the bottom sheet then revokes when the user confirms', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(true)
        const { result } = renderHook(() => useConnectedSitesScreen())

        result.current.handleRevoke('https://example.com')

        await waitFor(() =>
            expect(mockRevoke).toHaveBeenCalledWith('https://example.com'),
        )
        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
    })

    it('does not revoke when the user cancels the confirm sheet', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useConnectedSitesScreen())

        result.current.handleRevoke('https://example.com')

        await waitFor(() =>
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1),
        )
        expect(mockRevoke).not.toHaveBeenCalled()
    })
})
