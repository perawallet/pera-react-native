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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { TransactionFooter } from '../TransactionFooter'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useWebView } from '@modules/webview'
import { WebViewActions } from '@modules/webview/hooks/useWebViewStore'

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@modules/webview', () => ({
    useWebView: vi.fn(() => ({ pushWebView: vi.fn() })),
}))

describe('TransactionFooter', () => {
    const mockTransaction = {
        id: 'TX_ID',
    } as unknown as PeraDisplayableTransaction

    it('renders view in explorer button', () => {
        const { getByRole } = render(
            <TransactionFooter transaction={mockTransaction} />,
        )

        expect(getByRole('button')).toBeTruthy()
        expect(getByRole('button').textContent).toContain(
            'transactions.common.view_in_explorer',
        )
    })

    it('calls pushWebView when button is pressed', () => {
        const pushWebView = vi.fn()
        vi.mocked(useWebView).mockReturnValue({
            pushWebView,
            removeWebView: vi.fn(),
            clearWebViews: vi.fn(),
            popWebView: vi.fn(),
        } as WebViewActions)

        const { getByRole } = render(
            <TransactionFooter transaction={mockTransaction} />,
        )

        fireEvent.click(getByRole('button'))
        expect(pushWebView).toHaveBeenCalled()
    })
})
