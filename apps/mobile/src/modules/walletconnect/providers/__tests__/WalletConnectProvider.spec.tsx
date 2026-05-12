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
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { WalletConnectProvider } from '../WalletConnectProvider'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'
import type { Nullable } from '@perawallet/wallet-core-shared'

const mockInitWalletConnect = vi.fn()
const mockShowToast = vi.fn()
const mockErrorToast = vi.fn()
const mockRemoveSessionRequest = vi.fn()
const mockSetConnectionError = vi.fn()
let mockConnectionError: Error | null = null

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

vi.mock('@perawallet/wallet-core-walletconnect', () => {
    class MockWalletConnectInvalidNetworkError extends Error {
        constructor(message?: string) {
            super(message ?? 'wrong network')
            this.name = 'WalletConnectInvalidNetworkError'
            Object.setPrototypeOf(
                this,
                MockWalletConnectInvalidNetworkError.prototype,
            )
        }
    }
    return {
        useWalletConnect: () => ({
            initWalletConnect: mockInitWalletConnect,
        }),
        useWalletConnectSessionRequests: () => ({
            sessionRequests: mockSessionRequests,
            removeSessionRequest: mockRemoveSessionRequest,
        }),
        useWalletConnectStore: (
            selector: (state: {
                connectionError: Error | null
                setConnectionError: typeof mockSetConnectionError
            }) => unknown,
        ) =>
            selector({
                connectionError: mockConnectionError,
                setConnectionError: mockSetConnectionError,
            }),
        WalletConnectInvalidNetworkError: MockWalletConnectInvalidNetworkError,
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
        errorToast: mockErrorToast,
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
        onError,
    }: {
        request: WalletConnectSessionRequest
        onSuccess: (req: WalletConnectSessionRequest) => void
        onError: (error?: Error) => void
    }) => (
        <div data-testid='ConnectionView'>
            <span>{request.peerMeta.name}</span>
            <button onClick={() => onSuccess(request)}>mock-connect</button>
            <button onClick={() => onError(new Error('Connection failed'))}>
                mock-error
            </button>
        </div>
    ),
}))

vi.mock('../../components/ConnectionSuccessContent', () => ({
    ConnectionSuccessContent: ({
        request,
    }: {
        request: Nullable<WalletConnectSessionRequest>
    }) => <div data-testid='SuccessSheetContent'>{request?.peerMeta.name}</div>,
}))

vi.mock('../../components/WalletConnectErrorContent', () => ({
    WalletConnectErrorContent: ({ error }: { error: Nullable<Error> }) => (
        <div data-testid='ErrorSheetContent'>{error?.message}</div>
    ),
}))

const mockRequestBottomSheet = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
    }),
}))

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
        mockConnectionError = null
        mockRequestBottomSheet.mockReturnValue(new Promise(() => {}))
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

    test('requests the success sheet after connection approval', async () => {
        mockSessionRequests = [mockRequest]

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        fireEvent.click(screen.getByText('mock-connect'))

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        const contents = arg.contents as ReactElement<{
            request: WalletConnectSessionRequest
        }>
        expect(contents.props.request).toBe(mockRequest)
        expect(arg.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
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

    test('clears success request after the success sheet resolves', async () => {
        mockSessionRequests = [mockRequest]
        let resolveRequest: (value?: unknown) => void = () => {}
        mockRequestBottomSheet.mockReturnValue(
            new Promise(resolve => {
                resolveRequest = resolve
            }),
        )

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        fireEvent.click(screen.getByText('mock-connect'))
        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })

        // ConnectionView remains hidden while the success sheet is pending.
        expect(screen.queryByTestId('ConnectionView')).toBeNull()

        await act(async () => {
            resolveRequest()
            await Promise.resolve()
        })

        // Once the host resolves, ConnectionView becomes visible again because
        // successRequest cleared back to null.
        await waitFor(() => {
            expect(screen.getByTestId('ConnectionView')).toBeDefined()
        })
    })

    test('writes connection error to store and removes request when ConnectionView fails', () => {
        mockSessionRequests = [mockRequest]

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        fireEvent.click(screen.getByText('mock-error'))

        expect(mockSetConnectionError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Connection failed' }),
        )
        expect(mockRemoveSessionRequest).toHaveBeenCalledWith(mockRequest)
    })

    test('requests the error sheet when connectionError is set in the store', async () => {
        mockConnectionError = new Error('Sign request failed')

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        const contents = arg.contents as ReactElement<{ error: Error }>
        expect(contents.props.error).toBe(mockConnectionError)
        expect(arg.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
    })

    test('hides connection view when error bottom sheet is shown', () => {
        mockSessionRequests = [mockRequest]
        mockConnectionError = new Error('Sign request failed')

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        expect(screen.queryByTestId('ConnectionView')).toBeNull()
    })

    test('clears error and removes session request after the error sheet resolves', async () => {
        mockSessionRequests = [mockRequest]
        mockConnectionError = new Error('Sign request failed')
        let resolveRequest: (value?: unknown) => void = () => {}
        mockRequestBottomSheet.mockReturnValue(
            new Promise(resolve => {
                resolveRequest = resolve
            }),
        )

        render(
            <WalletConnectProvider>
                <div />
            </WalletConnectProvider>,
        )

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            resolveRequest()
            await Promise.resolve()
        })

        await waitFor(() => {
            expect(mockSetConnectionError).toHaveBeenCalledWith(null)
        })
        expect(mockRemoveSessionRequest).toHaveBeenCalledWith(mockRequest)
    })
})
