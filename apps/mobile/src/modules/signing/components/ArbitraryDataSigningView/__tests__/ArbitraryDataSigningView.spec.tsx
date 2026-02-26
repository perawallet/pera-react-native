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
import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArbitraryDataSigningView } from '../ArbitraryDataSigningView'
import { ArbitraryDataSignRequest } from '@perawallet/wallet-core-signing'
import { useArbitraryDataSigningScreen } from '@modules/signing/screens/ArbitraryDataSigningScreen/useArbitraryDataSigningScreen'

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style }: any) => <div style={style}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children, style }: any) => <span style={style}>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),

    PWIcon: () => null,

    PWImage: () => null,
    PWTabView: {
        createNavigator: () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Navigator: ({ children }: any) => <div>{children}</div>,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Screen: ({ children, name }: any) => {
                if (name !== 'Main') return null
                return (
                    <div>
                        {typeof children === 'function'
                            ? children({
                                  navigation: {
                                      navigate: vi.fn(),
                                      goBack: vi.fn(),
                                  },
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              } as any)
                            : children}
                    </div>
                )
            },
        }),
    },
}))

vi.mock('@perawallet/wallet-core-signing', async () => ({
    useSigningRequest: vi.fn(() => ({
        currentRequest: null,
        pendingSignRequests: [],
        lastCompletedRequest: null,
        clearLastCompletedRequest: vi.fn(),
        removeSignRequest: vi.fn(),
        signAndSendRequest: vi.fn(),
        rejectRequest: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useAllAccounts: vi.fn(() => []),
    useFindAccountByAddress: vi.fn(() => null),
}))

vi.mock(
    '@modules/signing/screens/ArbitraryDataSigningScreen/useArbitraryDataSigningScreen',
    () => ({
        useArbitraryDataSigningScreen: vi.fn(() => ({
            request: null,
            isSingleSignRequest: true,
            isPending: false,
            handleApprove: vi.fn(),
            handleReject: vi.fn(),
            handleDetailsPress: vi.fn(),
        })),
    }),
)

vi.mock('@modules/webview/hooks', () => ({
    useWebView: vi.fn(() => ({
        pushWebView: vi.fn(),
    })),
}))

vi.mock('../ArbitraryDataSigningDetailsView', () => ({
    ArbitraryDataSigningDetailsView: () => (
        <div data-testid='details-view'>DetailsView</div>
    ),
}))

describe('ArbitraryDataSigningView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const mockSingleRequest = {
        type: 'arbitrary-data',
        transport: 'callback',
        data: [
            {
                signer: 'test-address',
                message: 'Please sign this message',
            },
        ],
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

    const setupMock = (request: ArbitraryDataSignRequest) => {
        vi.mocked(useArbitraryDataSigningScreen).mockReturnValue({
            request,
            isSingleSignRequest: request.data.length === 1,
            isPending: false,
            handleApprove: vi.fn(),
            handleReject: vi.fn(),
            handleDetailsPress: vi.fn(),
        })
    }

    it('renders title for arbitrary data signing', () => {
        setupMock(mockSingleRequest)
        const { container } = render(
            <ArbitraryDataSigningView request={mockSingleRequest} />,
        )
        // Check for key part of title since we might be getting translation keys
        expect(container.textContent?.toLowerCase()).toContain('sign')
    })

    it('renders cancel and confirm buttons', () => {
        setupMock(mockSingleRequest)
        const { container } = render(
            <ArbitraryDataSigningView request={mockSingleRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('cancel')
        expect(text).toContain('confirm')
    })

    it('shows Confirm All for multiple sign requests', () => {
        setupMock(mockMultipleRequest)
        const { container } = render(
            <ArbitraryDataSigningView request={mockMultipleRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('confirm')
        expect(text).toContain('all')
    })

    it('displays the message to be signed', () => {
        setupMock(mockSingleRequest)
        const { container } = render(
            <ArbitraryDataSigningView request={mockSingleRequest} />,
        )
        expect(container.textContent).toContain('Please sign this message')
    })

    it('renders source metadata when available', () => {
        const requestWithMetadata = {
            ...mockSingleRequest,
            sourceMetadata: {
                name: 'Test DApp',
                url: 'https://test.com',
            },
        } as unknown as ArbitraryDataSignRequest
        setupMock(requestWithMetadata)

        const { container } = render(
            <ArbitraryDataSigningView request={requestWithMetadata} />,
        )
        expect(container.textContent).toContain('Test DApp')
    })
})
