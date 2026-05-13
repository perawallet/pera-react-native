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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, render } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { ExportShareAccountContent } from '../ExportShareAccountContent'

const { mockCopyToClipboard } = vi.hoisted(() => ({
    mockCopyToClipboard: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        buildDeeplink: ({ address }: { address: string }) =>
            `perawallet://app/shared-account-import/?address=${encodeURIComponent(address)}`,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@utils/shareText', () => ({
    shareText: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
}))

vi.mock('react-native-qrcode-svg', () => ({
    default: () => React.createElement('div', { 'data-testid': 'qr-code' }),
}))

const TEST_ADDRESS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ExportShareAccountContent accountAddress={TEST_ADDRESS} />
        </BottomSheetIdContext.Provider>,
    )

describe('ExportShareAccountContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('dismisses the caller promise when the cross icon is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('icon-cross'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })

    it('copies the URL when Copy URL button is pressed', () => {
        renderWithId()

        fireEvent.click(screen.getByText('multisig.export.copy_url'))
        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            `perawallet://app/shared-account-import/?address=${encodeURIComponent(TEST_ADDRESS)}`,
        )
    })
})
