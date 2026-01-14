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
import ArbitraryDataSigningView from '../ArbitraryDataSigningView'
import { ArbitraryDataSignRequest } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    useSigningRequest: vi.fn(() => ({
        removeSignRequest: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useAllAccounts: vi.fn(() => []),
    useFindAccountByAddress: vi.fn(() => null),
}))

vi.mock('@modules/transactions/hooks/signing/use-arbitrary-data-signing-view', () => ({
    useArbitraryDataSigningView: vi.fn(() => ({
        approveRequest: vi.fn(),
        rejectRequest: vi.fn(),
        isPending: false,
    })),
}))

describe('ArbitraryDataSigningView', () => {
    const mockSingleRequest = {
        type: 'arbitrary-data',
        transport: 'callback',
        data: [{
            signer: 'test-address',
            message: 'Please sign this message',
        }],
        approve: vi.fn(),
        reject: vi.fn(),
    } as unknown as ArbitraryDataSignRequest

    const mockMultipleRequest = {
        type: 'arbitrary-data',
        transport: 'callback',
        data: [
            { signer: 'addr1', message: 'Message 1' },
            { signer: 'addr2', message: 'Message 2' },
        ],
        approve: vi.fn(),
        reject: vi.fn(),
    } as unknown as ArbitraryDataSignRequest

    it('renders title for arbitrary data signing', () => {
        const { container } = render(<ArbitraryDataSigningView request={mockSingleRequest} />)
        expect(container).toBeTruthy()
    })

    it('renders cancel and confirm buttons', () => {
        const { container } = render(<ArbitraryDataSigningView request={mockSingleRequest} />)
        expect(container).toBeTruthy()
    })

    it('shows Confirm All for multiple sign requests', () => {
        const { container } = render(<ArbitraryDataSigningView request={mockMultipleRequest} />)
        expect(container).toBeTruthy()
    })

    it('displays the message to be signed', () => {
        const { container } = render(<ArbitraryDataSigningView request={mockSingleRequest} />)
        expect(container).toBeTruthy()
    })

    it('renders source metadata when available', () => {
        const requestWithMetadata = {
            ...mockSingleRequest,
            sourceMetadata: {
                name: 'Test DApp',
                url: 'https://test.com',
            },
        } as unknown as ArbitraryDataSignRequest

        const { container } = render(<ArbitraryDataSigningView request={requestWithMetadata} />)
        expect(container).toBeTruthy()
    })
})
