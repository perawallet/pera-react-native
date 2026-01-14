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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Arc60SigningView from '../Arc60SigningView'
import { Arc60SignRequest, useSigningRequest } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual = await importOriginal<typeof import('@perawallet/wallet-core-blockchain')>()
    return {
        ...actual,
        useSigningRequest: vi.fn(() => ({
            removeSignRequest: vi.fn(),
        })),
    }
})

describe('Arc60SigningView', () => {
    const mockRequest = {
        type: 'arc60',
        transport: 'callback',
        reject: vi.fn(),
    } as unknown as Arc60SignRequest

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders not implemented message', () => {
        const { container } = render(<Arc60SigningView request={mockRequest} />)
        expect(container.textContent?.toLowerCase()).toContain('not implemented')
    })

    it('renders cancel and confirm buttons', () => {
        const { container } = render(<Arc60SigningView request={mockRequest} />)
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('cancel')
        expect(text).toContain('confirm')
    })

    it('calls removeSignRequest on cancel', () => {
        const removeSignRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            removeSignRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        const { container } = render(<Arc60SigningView request={mockRequest} />)
        
        const buttons = container.querySelectorAll('button')
        const cancelButton = Array.from(buttons).find(btn => 
            btn.textContent?.toLowerCase().includes('cancel')
        )
        if (cancelButton) {
            fireEvent.click(cancelButton)
            expect(removeSignRequest).toHaveBeenCalledWith(mockRequest)
        }
    })

    it('calls reject callback when transport is callback', () => {
        const rejectMock = vi.fn()
        const requestWithReject = {
            ...mockRequest,
            reject: rejectMock,
        } as unknown as Arc60SignRequest

        const removeSignRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            removeSignRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        const { container } = render(<Arc60SigningView request={requestWithReject} />)
        
        const buttons = container.querySelectorAll('button')
        const cancelButton = Array.from(buttons).find(btn => 
            btn.textContent?.toLowerCase().includes('cancel')
        )
        if (cancelButton) {
            fireEvent.click(cancelButton)
            expect(rejectMock).toHaveBeenCalled()
        }
    })

    it('calls removeSignRequest on confirm', () => {
        const removeSignRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            removeSignRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        const { container } = render(<Arc60SigningView request={mockRequest} />)
        
        const buttons = container.querySelectorAll('button')
        const confirmButton = Array.from(buttons).find(btn => 
            btn.textContent?.toLowerCase().includes('confirm')
        )
        if (confirmButton) {
            fireEvent.click(confirmButton)
            expect(removeSignRequest).toHaveBeenCalledWith(mockRequest)
        }
    })
})
