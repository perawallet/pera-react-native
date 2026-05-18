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
import { render, fireEvent, screen } from '@test-utils/render'
import en from '@/i18n/locales/en.json'
import { TransactionPreview } from '../TransactionPreview'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const mockRequest = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        classifyDisplayableTransaction: vi.fn(() => 'payment'),
    }
})

// Resolve dot-separated i18n key against the en.json translations
const resolveKey = (key: string): string => {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = en
    for (const part of parts) {
        node = node?.[part]
    }
    return typeof node === 'string' ? node : key
}

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: resolveKey }),
}))

const tx = { id: 'tx1' } as PeraDisplayableTransaction

describe('TransactionPreview — external pill', () => {
    beforeEach(() => {
        mockRequest.mockReset()
    })

    it('does not render the pill when isExternal is false', () => {
        render(<TransactionPreview transaction={tx} />)
        expect(screen.queryByText('Other signer')).toBeNull()
    })

    it('renders the pill when isExternal is true', () => {
        render(
            <TransactionPreview
                transaction={tx}
                isExternal
            />,
        )
        expect(screen.getByText('Other signer')).toBeTruthy()
    })

    it('pressing the pill opens the explainer sheet without firing row onPress', () => {
        const onPress = vi.fn()
        render(
            <TransactionPreview
                transaction={tx}
                onPress={onPress}
                isExternal
            />,
        )

        fireEvent.click(screen.getByTestId('transaction-preview-external-pill'))

        expect(mockRequest).toHaveBeenCalledOnce()
        expect(onPress).not.toHaveBeenCalled()
    })
})
