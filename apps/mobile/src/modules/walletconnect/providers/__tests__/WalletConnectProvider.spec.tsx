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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WalletConnectProvider } from '../WalletConnectProvider'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'

const mockInitWalletConnect = vi.fn()
const mockShowToast = vi.fn()

const mockRequest = {
    peerMeta: {
        name: 'Test dApp',
        url: 'https://test-dapp.com',
        icons: [],
        description: '',
    },
    chainId: 416001,
    permissions: ['algo_getAccounts'],
    clientId: 'client-123',
} as unknown as WalletConnectSessionRequest

let mockSessionRequests: WalletConnectSessionRequest[] = []

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({
        initWalletConnect: mockInitWalletConnect,
    }),
    useWalletConnectSessionRequests: () => ({
        sessionRequests: mockSessionRequests,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: () => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
    }),
}))

vi.mock(
    '../../components/BaseErrorBoundary/WalletConnectErrorBoundary',
    () => ({
        WalletConnectErrorBoundary: ({
            children,
        }: {
            children: React.ReactNode
        }) => <div data-testid='ErrorBoundary'>{children}</div>,
    }),
)

vi.mock('../../components/ConnectionView/ConnectionView', () => ({
    ConnectionView: ({
        request,
        onSuccess,
    }: {
        request: WalletConnectSessionRequest
        onSuccess: (req: WalletConnectSessionRequest) => void
    }) => (
        <div data-testid='ConnectionView'>
            <span>{request.peerMeta.name}</span>
            <button onClick={() => onSuccess(request)}>mock-connect</button>
        </div>
    ),
}))

vi.mock(
    '../../components/ConnectionSuccessBottomSheet/ConnectionSuccessBottomSheet',
    () => ({
        ConnectionSuccessBottomSheet: ({
            onClose,
            request,
        }: {
            onClose: () => void
            request: WalletConnectSessionRequest | null
        }) =>
            request ? (
                <div data-testid='SuccessSheet'>
                    <span>{request.peerMeta.name}</span>
                    <button onClick={onClose}>mock-close</button>
                </div>
            ) : null,
    }),
)

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) =>
        isVisible ? <div data-testid='PWBottomSheet'>{children}</div> : null,
}))

vi.mock('react-native', () => ({
    useWindowDimensions: () => ({ height: 800, width: 400 }),
}))

describe('WalletConnectProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSessionRequests = []
    })

    test('renders children', () => {
        render(
            <WalletConnectProvider>
                <div data-testid='child'>Hello</div>
            </WalletConnectProvider>,
        )

        expect(screen.getByTestId('child')).toBeDefined()
    })

    test('initializes WalletConnect on mount', () => {
        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        expect(mockInitWalletConnect).toHaveBeenCalledTimes(1)
    })

    test('wraps children in error boundary', () => {
        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        expect(screen.getByTestId('ErrorBoundary')).toBeDefined()
    })

    test('shows connection bottom sheet when session request exists', () => {
        mockSessionRequests = [mockRequest]

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        expect(screen.getByTestId('PWBottomSheet')).toBeDefined()
        expect(screen.getByTestId('ConnectionView')).toBeDefined()
    })

    test('does not show connection bottom sheet when no requests', () => {
        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    test('shows success sheet after connection approval', () => {
        mockSessionRequests = [mockRequest]

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        fireEvent.click(screen.getByText('mock-connect'))

        expect(screen.getByTestId('SuccessSheet')).toBeDefined()
    })

    test('hides connection view while success sheet is shown', () => {
        mockSessionRequests = [mockRequest]

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        fireEvent.click(screen.getByText('mock-connect'))

        // Connection bottom sheet should be hidden (isVisible=false because successRequest is set)
        expect(screen.queryByTestId('ConnectionView')).toBeNull()
    })

    test('clears success sheet on close', () => {
        mockSessionRequests = [mockRequest]

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        fireEvent.click(screen.getByText('mock-connect'))
        expect(screen.getByTestId('SuccessSheet')).toBeDefined()

        fireEvent.click(screen.getByText('mock-close'))
        expect(screen.queryByTestId('SuccessSheet')).toBeNull()
    })
})
