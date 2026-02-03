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
import { ArbitraryDataSigningView } from '../ArbitraryDataSigningView'
import { ArbitraryDataSignRequest } from '@perawallet/wallet-core-blockchain'

// Mock createPWTabNavigator
vi.mock('@components/core/PWTabView/PWTabView', () => {
    const React = require('react')
    const MockNavigator = ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    )
    const MockScreen = ({ children, component: Component, name }: any) => {
        if (name !== 'Main') return null
        return (
            <div>
                {children ? (typeof children === 'function' ? children({ navigation: { navigate: vi.fn(), goBack: vi.fn() } }) : children) : null}
                {Component ? <Component navigation={{ navigate: vi.fn(), goBack: vi.fn() }} route={{ params: {} }} /> : null}
            </div>
        )
    }
    return {
        createPWTabNavigator: () => ({
            Navigator: MockNavigator,
            Screen: MockScreen,
        }),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    useSigningRequest: vi.fn(() => ({
        removeSignRequest: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useAllAccounts: vi.fn(() => []),
    useFindAccountByAddress: vi.fn(() => null),
}))

vi.mock(
    '@modules/transactions/hooks/signing/useArbitraryDataSigningView',
    () => ({
        useArbitraryDataSigningView: vi.fn(() => ({
            approveRequest: vi.fn(),
            rejectRequest: vi.fn(),
            isPending: false,
        })),
    }),
)

vi.mock('@hooks/usePeraWebviewInterface', () => ({
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

    it('renders title for arbitrary data signing', () => {
        const { container } = render(
            <ArbitraryDataSigningView request={mockSingleRequest} />,
        )
        // Check for key part of title since we might be getting translation keys
        expect(container.textContent?.toLowerCase()).toContain('sign')
    })

    it('renders cancel and confirm buttons', () => {
        const { container } = render(
            <ArbitraryDataSigningView request={mockSingleRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('cancel')
        expect(text).toContain('confirm')
    })

    it('shows Confirm All for multiple sign requests', () => {
        const { container } = render(
            <ArbitraryDataSigningView request={mockMultipleRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('confirm')
        expect(text).toContain('all')
    })

    it('displays the message to be signed', () => {
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

        const { container } = render(
            <ArbitraryDataSigningView request={requestWithMetadata} />,
        )
        expect(container.textContent).toContain('Test DApp')
    })
})
