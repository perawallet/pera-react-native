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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import SigningView from '../SigningView'
import { SignRequest } from '@perawallet/wallet-core-blockchain'

vi.mock('../TransactionSigningView', () => ({
    default: () => <div data-testid="transaction-signing-view">TransactionSigningView</div>,
}))

vi.mock('../ArbitraryDataSigningView', () => ({
    default: () => <div data-testid="arbitrary-data-signing-view">ArbitraryDataSigningView</div>,
}))

vi.mock('../Arc60SigningView', () => ({
    default: () => <div data-testid="arc60-signing-view">Arc60SigningView</div>,
}))

describe('SigningView', () => {
    it('renders TransactionSigningView for transaction requests', () => {
        const request = {
            type: 'transactions',
            txs: [],
        } as unknown as SignRequest

        const { container } = render(<SigningView request={request} />)
        expect(container.textContent).toContain('TransactionSigningView')
    })

    it('renders ArbitraryDataSigningView for arbitrary-data requests', () => {
        const request = {
            type: 'arbitrary-data',
            data: [],
        } as unknown as SignRequest

        const { container } = render(<SigningView request={request} />)
        expect(container.textContent).toContain('ArbitraryDataSigningView')
    })

    it('renders Arc60SigningView for arc60 requests', () => {
        const request = {
            type: 'arc60',
        } as unknown as SignRequest

        const { container } = render(<SigningView request={request} />)
        expect(container.textContent).toContain('Arc60SigningView')
    })

    it('renders empty view for unknown request types', () => {
        const request = {
            type: 'unknown-type',
        } as unknown as SignRequest

        const { container } = render(<SigningView request={request} />)
        expect(container.textContent?.toLowerCase()).toContain('unknown')
    })
})
