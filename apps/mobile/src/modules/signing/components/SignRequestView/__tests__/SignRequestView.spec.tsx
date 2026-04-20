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

import { fireEvent, render } from '@test-utils/render'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignRequestView } from '../SignRequestView'
import {
    SignRequest,
    type FailedSignRequest,
} from '@perawallet/wallet-core-signing'

vi.mock('@modules/signing/routes', () => ({
    SigningRoutes: ({ request }: { request: SignRequest }) => {
        if (request.type === 'transactions')
            return <div>TransactionSigningView</div>
        if (request.type === 'arbitrary-data')
            return <div>ArbitraryDataSigningView</div>
        if (request.type === 'arc60') return <div>Arc60SigningView</div>
        return null
    },
}))

const mockRemoveSignRequest = vi.fn()
const mockClearLastFailedRequest = vi.fn()
const signingRequestMock = {
    lastFailedRequest: null as FailedSignRequest | null,
}

vi.mock('@perawallet/wallet-core-signing', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-signing')>()
    return {
        ...original,
        useSigningRequest: () => ({
            removeSignRequest: mockRemoveSignRequest,
            clearLastFailedRequest: mockClearLastFailedRequest,
            lastFailedRequest: signingRequestMock.lastFailedRequest,
        }),
    }
})

describe('SigningView', () => {
    beforeEach(() => {
        signingRequestMock.lastFailedRequest = null
        mockRemoveSignRequest.mockReset()
        mockClearLastFailedRequest.mockReset()
    })

    it('renders TransactionSigningView for transaction requests', () => {
        const request = {
            id: 'tx-1',
            type: 'transactions',
            txs: [],
        } as unknown as SignRequest

        const { container } = render(<SignRequestView request={request} />)
        expect(container.textContent).toContain('TransactionSigningView')
    })

    it('renders ArbitraryDataSigningView for arbitrary-data requests', () => {
        const request = {
            id: 'data-1',
            type: 'arbitrary-data',
            data: [],
        } as unknown as SignRequest

        const { container } = render(<SignRequestView request={request} />)
        expect(container.textContent).toContain('ArbitraryDataSigningView')
    })

    it('renders Arc60SigningView for arc60 requests', () => {
        const request = {
            id: 'arc60-1',
            type: 'arc60',
        } as unknown as SignRequest

        const { container } = render(<SignRequestView request={request} />)
        expect(container.textContent).toContain('Arc60SigningView')
    })

    it('renders empty view for unknown request types', () => {
        const request = {
            id: 'unknown-1',
            type: 'unknown-type',
        } as unknown as SignRequest

        const { container } = render(<SignRequestView request={request} />)
        expect(container.textContent?.toLowerCase()).toContain('unknown')
    })

    it('renders inline failure view when request matches lastFailedRequest', () => {
        const request = {
            id: 'tx-1',
            type: 'transactions',
            txs: [],
        } as unknown as SignRequest
        signingRequestMock.lastFailedRequest = {
            request,
            error: new Error('bad things'),
        }

        const { container } = render(<SignRequestView request={request} />)
        expect(container.textContent).toContain('signing.signing_failed.title')
        expect(container.textContent).not.toContain('TransactionSigningView')
    })

    it('ignores a failure keyed to a different request id', () => {
        const request = {
            id: 'tx-1',
            type: 'transactions',
            txs: [],
        } as unknown as SignRequest
        signingRequestMock.lastFailedRequest = {
            request: { ...request, id: 'tx-other' } as unknown as SignRequest,
            error: new Error('stale'),
        }

        const { container } = render(<SignRequestView request={request} />)
        expect(container.textContent).toContain('TransactionSigningView')
    })

    it('clears and removes the request on dismiss', () => {
        const request = {
            id: 'tx-1',
            type: 'transactions',
            txs: [],
        } as unknown as SignRequest
        signingRequestMock.lastFailedRequest = {
            request,
            error: new Error('bad things'),
        }

        const { getByText } = render(<SignRequestView request={request} />)
        fireEvent.click(getByText('common.done'))

        expect(mockClearLastFailedRequest).toHaveBeenCalled()
        expect(mockRemoveSignRequest).toHaveBeenCalledWith(request)
    })
})
