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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExportShareAccountBottomSheet } from '../useExportShareAccountBottomSheet'

const { mockCopyToClipboard } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
}))
const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }))
const { mockShareText } = vi.hoisted(() => ({ mockShareText: vi.fn() }))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        buildDeeplink: ({ address }: { address: string }) =>
            `perawallet://app/shared-account-import/?address=${encodeURIComponent(address)}`,
    }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@utils/shareText', () => ({
    shareText: mockShareText,
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

const TEST_ADDRESS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

describe('useExportShareAccountBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockShareText.mockResolvedValue(undefined)
    })

    it('builds the export URL from the account address', () => {
        const { result } = renderHook(() =>
            useExportShareAccountBottomSheet({ accountAddress: TEST_ADDRESS }),
        )

        expect(result.current.exportUrl).toBe(
            `perawallet://app/shared-account-import/?address=${encodeURIComponent(TEST_ADDRESS)}`,
        )
    })

    it('copies the export URL to clipboard on handleCopyUrl', () => {
        const { result } = renderHook(() =>
            useExportShareAccountBottomSheet({ accountAddress: TEST_ADDRESS }),
        )

        act(() => {
            result.current.handleCopyUrl()
        })

        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            result.current.exportUrl,
        )
    })

    it('shares the export URL on handleShareUrl', async () => {
        const { result } = renderHook(() =>
            useExportShareAccountBottomSheet({ accountAddress: TEST_ADDRESS }),
        )

        await act(async () => {
            await result.current.handleShareUrl()
        })

        expect(mockShareText).toHaveBeenCalledWith({
            title: 'multisig.export.title',
            message: result.current.exportUrl,
        })
    })

    it('shows an error toast when shareText throws', async () => {
        mockShareText.mockRejectedValue(new Error('cancelled'))

        const { result } = renderHook(() =>
            useExportShareAccountBottomSheet({ accountAddress: TEST_ADDRESS }),
        )

        await act(async () => {
            await result.current.handleShareUrl()
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.any(Error),
            expect.any(String),
            expect.any(Object),
        )
    })
})
