/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWalletConnect } from '../useWalletConnect'
import { __resetRegistryForTests, getConnector } from '../../connection'
import { useWalletConnectStore } from '../../store'
import { useWalletConnectSessionRequests } from '../useWalletConnectSessionRequests'
import { useWalletConnectHandlers } from '../useWalletConnectHandlers'
import WalletConnect from '@perawallet/walletconnect'
import { PERA_CLIENT_META, SESSION_REQUEST_TTL_MS } from '../../constants'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSessionRequestExpiredError,
} from '../../errors'
import { AlgorandChainId } from '../../models'
import { Networks, logger } from '@perawallet/wallet-core-shared'

// Mock dependencies
vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

// Partial mock: the hook is stubbed per-test, but `isSessionRequestFresh`
// stays real so approveSession's TTL gate is exercised for real.
vi.mock('../useWalletConnectSessionRequests', async importOriginal => ({
    ...(await importOriginal<
        typeof import('../useWalletConnectSessionRequests')
    >()),
    useWalletConnectSessionRequests: vi.fn(),
}))

vi.mock('../useWalletConnectHandlers', () => ({
    useWalletConnectHandlers: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
    useSigningAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

vi.mock('@perawallet/walletconnect', () => {
    return {
        default: vi.fn().mockImplementation(function (options) {
            const instance: Record<string, unknown> = {
                on: vi.fn(),
                off: vi.fn(),
                killSession: vi.fn(),
                approveSession: vi.fn(),
                // The real WC v1 client throws when asked to reject an
                // already-established session (dist/index.js:961). Encode that
                // so the silent-overwrite path is actually exercised: without
                // it the old test asserted intended behaviour against a fn that
                // never threw (PERA-4713).
                rejectSession: vi.fn(() => {
                    if (instance.connected) {
                        throw new Error('Session currently connected')
                    }
                }),
                connected: false,
                clientId: options?.clientId || 'mock-client-id',
                session: {},
                // The real client opens its socket in the constructor;
                // ensureConnectorReady fast-paths on this. Failure tests
                // flip it to false to simulate a dead socket.
                _transport: { connected: true },
            }
            return instance
        }),
    }
})

vi.mock('@perawallet/wallet-core-shared', () => ({
    Networks: {
        mainnet: 'mainnet',
        testnet: 'testnet',
    },
    Network: String,
    logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    registerStore: vi.fn(),
    AppError: class AppError extends Error {},
    ErrorCategory: { WALLETCONNECT: 'WALLETCONNECT' },
    ErrorSeverity: { HIGH: 'HIGH' },
    BaseStoreState: class {},
    generateOrderedUniqueId: vi.fn(() => 'mock-id'),
    decodeFromBase64: vi.fn(),
    encodeToBase64: vi.fn(),
    createRef: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 64,
}))

describe('useWalletConnect', () => {
    const mockSetConnections = vi.fn()
    const mockAddSessionRequest = vi.fn()
    const mockHandleSignData = vi.fn()
    const mockHandleSignTransaction = vi.fn()
    const mockSetConnectionError = vi.fn()
    let mockConnections: any[]

    beforeEach(() => {
        vi.clearAllMocks()
        mockConnections = []
        ;(useWalletConnectStore as any).mockImplementation((selector: any) =>
            selector({
                walletConnectConnections: mockConnections,
                setWalletConnectConnections: mockSetConnections,
            }),
        )
        ;(useWalletConnectStore as any).getState = () => ({
            setConnectionError: mockSetConnectionError,
            walletConnectConnections: mockConnections,
        })
        ;(useWalletConnectSessionRequests as any).mockReturnValue({
            addSessionRequest: mockAddSessionRequest,
        })
        ;(useWalletConnectHandlers as any).mockReturnValue({
            handleSignData: mockHandleSignData,
            handleSignTransaction: mockHandleSignTransaction,
        })
    })

    afterEach(() => {
        // The connector registry is module-level state shared across the
        // whole suite — reset it so each test starts from a clean slate.
        __resetRegistryForTests()
    })

    describe('connect', () => {
        it('should initialize connector and bind events', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = {
                clientId: 'test-session',
                topic: 'abc',
                bridge: 'xyz',
                key: '123',
            } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            expect(WalletConnect).toHaveBeenCalledWith({
                ...connection,
                clientMeta: PERA_CLIENT_META,
            })

            // We can't easily access the created connector instance from here since it's inside the hook's scope (or module scope).
            // But we know `WalletConnect` constructor returns a mock with `on` method.
            // We can verify `on` was called.
            // To do this strictly, we'd need to spy on the mock instance returned.
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            expect(mockConnectorInstance.on).toHaveBeenCalledWith(
                'algo_signData',
                expect.any(Function),
            )
            expect(mockConnectorInstance.on).toHaveBeenCalledWith(
                'algo_signTxn',
                expect.any(Function),
            )
            expect(mockConnectorInstance.on).toHaveBeenCalledWith(
                'disconnect',
                expect.any(Function),
            )
            expect(mockConnectorInstance.on).toHaveBeenCalledWith(
                'session_request',
                expect.any(Function),
            )
            expect(mockConnectorInstance.on).toHaveBeenCalledWith(
                'error',
                expect.any(Function),
            )
        })

        it('should handle session_request event', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-request' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            const payload = {
                params: [
                    {
                        peerMeta: { name: 'App' },
                        chainId: 4160,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockAddSessionRequest).toHaveBeenCalledWith({
                peerMeta: { name: 'App' },
                chainId: 4160,
                permissions: ['perm1'],
                clientId: 'client-request',
            })
        })

        it('never auto-approves a session_request — always routes to the approval sheet', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-no-auto' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            const payload = {
                params: [
                    {
                        peerMeta: { name: 'App' },
                        chainId: 4160,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            // No zero-click connect: the wallet must never hand a dApp account
            // addresses without the user approving through the sheet.
            expect(mockConnectorInstance.approveSession).not.toHaveBeenCalled()
            expect(mockAddSessionRequest).toHaveBeenCalledWith({
                peerMeta: { name: 'App' },
                chainId: 4160,
                permissions: ['perm1'],
                clientId: 'client-no-auto',
            })
        })

        it('should reject session and surface invalid network error when chainId does not match active network', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-wrong-net' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            const payload = {
                params: [
                    {
                        peerMeta: { name: 'Testnet App' },
                        chainId: AlgorandChainId.testnet,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockConnectorInstance.rejectSession).toHaveBeenCalledTimes(1)
            expect(mockSetConnectionError).toHaveBeenCalledTimes(1)
            expect(mockSetConnectionError.mock.calls[0][0]).toBeInstanceOf(
                WalletConnectInvalidNetworkError,
            )
            expect(mockAddSessionRequest).not.toHaveBeenCalled()
            expect(mockConnectorInstance.approveSession).not.toHaveBeenCalled()
        })

        it('should add session request when chainId matches active network', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-match-net' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            const payload = {
                params: [
                    {
                        peerMeta: { name: 'Mainnet App' },
                        chainId: AlgorandChainId.mainnet,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockAddSessionRequest).toHaveBeenCalledWith({
                peerMeta: { name: 'Mainnet App' },
                chainId: AlgorandChainId.mainnet,
                permissions: ['perm1'],
                clientId: 'client-match-net',
            })
            expect(mockConnectorInstance.rejectSession).not.toHaveBeenCalled()
            expect(mockSetConnectionError).not.toHaveBeenCalled()
        })

        it('should reject session and surface invalid network error when chainId does not match active network (store-populated)', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = {
                clientId: 'client-auto-wrong-net',
            } as any

            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            const payload = {
                params: [
                    {
                        peerMeta: { name: 'Testnet App' },
                        chainId: AlgorandChainId.testnet,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockConnectorInstance.rejectSession).toHaveBeenCalledTimes(1)
            expect(mockSetConnectionError).toHaveBeenCalledTimes(1)
            expect(mockSetConnectionError.mock.calls[0][0]).toBeInstanceOf(
                WalletConnectInvalidNetworkError,
            )
            expect(mockConnectorInstance.approveSession).not.toHaveBeenCalled()
            expect(mockAddSessionRequest).not.toHaveBeenCalled()
        })

        it('does not call rejectSession on a connected connector for a wrong-network request but still surfaces the error (PERA-4713)', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-connected-wrong-net' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            // A live session already exists on this connector, so the library's
            // rejectSession would throw — which is exactly what used to silence
            // the wrong-network branch and hide the peerMeta poisoning.
            mockConnectorInstance.connected = true

            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            const payload = {
                params: [
                    {
                        peerMeta: { name: 'Spoofed dApp' },
                        chainId: AlgorandChainId.testnet,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockConnectorInstance.rejectSession).not.toHaveBeenCalled()
            expect(mockSetConnectionError).toHaveBeenCalledTimes(1)
            expect(mockSetConnectionError.mock.calls[0][0]).toBeInstanceOf(
                WalletConnectInvalidNetworkError,
            )
        })

        it('refuses a repeat session_request on an already-connected session without touching the store (PERA-4713)', async () => {
            const connection = { clientId: 'client-established' } as any
            mockConnections.push(connection)

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            mockConnectorInstance.connected = true

            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            // A matching-chainId second handshake that swaps the displayed
            // identity — refused before it can pop a fresh approval sheet or
            // mutate the stored session.
            const payload = {
                params: [
                    {
                        peerMeta: { name: 'Spoofed dApp' },
                        chainId: AlgorandChainId.mainnet,
                        permissions: ['perm1'],
                    },
                ],
            }

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockAddSessionRequest).not.toHaveBeenCalled()
            expect(mockConnectorInstance.rejectSession).not.toHaveBeenCalled()
            expect(mockSetConnections).not.toHaveBeenCalled()
            expect(mockSetConnectionError).toHaveBeenCalledTimes(1)
            expect(mockSetConnectionError.mock.calls[0][0]).toBeInstanceOf(
                WalletConnectInvalidSessionError,
            )
        })

        it('should trigger handleSignData on algo_signData event', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-signdata' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const callback = mockConnectorInstance.on.mock.calls.find(
                (call: any) => call[0] === 'algo_signData',
            )[1]

            const payload = { some: 'payload' }
            const error = null

            act(() => {
                callback(error, payload)
            })

            expect(mockHandleSignData).toHaveBeenCalledWith(
                mockConnectorInstance,
                'mainnet',
                error,
                payload,
            )
        })

        it('should trigger handleSignTransaction on algo_signTxn event', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-signtxn' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const callback = mockConnectorInstance.on.mock.calls.find(
                (call: any) => call[0] === 'algo_signTxn',
            )[1]

            const payload = { some: 'txn' }
            const error = null

            act(() => {
                callback(error, payload)
            })

            expect(mockHandleSignTransaction).toHaveBeenCalledWith(
                mockConnectorInstance,
                'mainnet',
                error,
                payload,
            )
        })

        it('should handle disconnect event', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-disconnect' } as any
            mockConnections.push(connection)
            // We need mockSessions to be returned by store.
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            await act(async () => {
                await result.current.connect({ connection })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const disconnectCallback = mockConnectorInstance.on.mock.calls.find(
                (call: any) => call[0] === 'disconnect',
            )[1]

            await act(async () => {
                await disconnectCallback()
            })

            // disconnect calls setSessions filtering out the disconnected one
            // filtering: session.session?.clientId !== clientId
            // clientId is from the connector: 'mock-client-id'

            expect(mockSetConnections).toHaveBeenCalled()
            const newConnections = mockSetConnections.mock.calls[0][0]
            expect(newConnections).toHaveLength(0)
        })
    })

    describe('disconnect', () => {
        it('should kill session and remove from store', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-kill' } as any
            // Populate store so it can be filtered
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            // First connect to populate 'connectors' map
            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            mockConnectorInstance.connected = true

            await act(async () => {
                await result.current.disconnect('client-kill', true)
            })

            expect(mockConnectorInstance.killSession).toHaveBeenCalledWith({
                message: 'User disconnected',
            })
            expect(mockSetConnections).toHaveBeenCalled()
            const args = mockSetConnections.mock.calls[0][0]
            // actually mockSetSessions could be called multiple times.

            // safer check
            expect(args).toEqual([])
        })
    })

    describe('approveSession', () => {
        it('should approve session and update store', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-approve' } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            // Connect first
            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value

            const request = { chainId: 4160, permissions: {} } as any
            const addresses = ['addr1']

            await act(async () => {
                await result.current.approveSession(
                    'client-approve',
                    request,
                    addresses,
                )
            })

            expect(mockConnectorInstance.approveSession).toHaveBeenCalledWith({
                chainId: 4160,
                accounts: ['addr1'],
            })

            expect(mockSetConnections).toHaveBeenCalled()
            // The logic appends the new session info.
            const updatedConnections =
                mockSetConnections.mock.calls[
                    mockSetConnections.mock.calls.length - 1
                ][0]
            expect(updatedConnections).toHaveLength(1)
            expect(updatedConnections[0].clientId).toBe('client-approve')
            expect(updatedConnections[0].connected).toBe(false) // from mock default
            // verify existingSession merge
        })

        it('does not persist the session when the socket cannot be revived', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-dead' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            // Dead socket + no stored peer: revival is impossible, the
            // approval must fail instead of silently queueing into the void.
            mockConnectorInstance._transport.connected = false

            await expect(
                result.current.approveSession(
                    'client-dead',
                    { chainId: 4160, permissions: {} } as any,
                    ['addr1'],
                ),
            ).rejects.toThrow()

            expect(mockConnectorInstance.approveSession).not.toHaveBeenCalled()
            expect(mockSetConnections).not.toHaveBeenCalled()
        })

        it('refuses to approve an expired session request without touching the connector', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-expired' } as any

            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value

            const staleRequest = {
                chainId: 4160,
                permissions: {},
                createdAt: Date.now() - SESSION_REQUEST_TTL_MS - 1,
            } as any

            await expect(
                result.current.approveSession('client-expired', staleRequest, [
                    'addr1',
                ]),
            ).rejects.toThrow(WalletConnectSessionRequestExpiredError)

            expect(mockConnectorInstance.approveSession).not.toHaveBeenCalled()
            expect(mockSetConnections).not.toHaveBeenCalled()
        })
    })

    describe('rejectSession', () => {
        it('should reject session and update store', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-reject' } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            // Connect first
            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value

            await act(async () => {
                await result.current.rejectSession('client-reject')
            })

            expect(mockConnectorInstance.rejectSession).toHaveBeenCalled()
            expect(mockSetConnections).toHaveBeenCalled()
            const updatedConnections =
                mockSetConnections.mock.calls[
                    mockSetConnections.mock.calls.length - 1
                ][0]
            expect(updatedConnections).toHaveLength(0)
        })

        it('drops the request locally and surfaces the failure when reject delivery cannot revive the socket', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            const connection = { clientId: 'client-reject-dead' } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            mockConnectorInstance._transport.connected = false

            await act(async () => {
                await result.current.rejectSession('client-reject-dead')
            })

            // The user explicitly declined — never trap them behind a dead
            // socket: local state is cleaned, and the user is told the dApp
            // may not have heard.
            expect(mockConnectorInstance.rejectSession).not.toHaveBeenCalled()
            expect(mockSetConnectionError).toHaveBeenCalled()
            expect(mockSetConnections).toHaveBeenCalled()
            const updatedConnections =
                mockSetConnections.mock.calls[
                    mockSetConnections.mock.calls.length - 1
                ][0]
            expect(updatedConnections).toHaveLength(0)
        })

        it('keeps a live session in the store when rejectSession throws because it is already connected (PERA-4713)', async () => {
            const connection = { clientId: 'client-live' } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                await result.current.connect({ connection })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            mockConnectorInstance.connected = true

            await act(async () => {
                await result.current.rejectSession('client-live')
            })

            // The throw is caught and surfaced, but the still-connected session
            // must not be force-deleted from the store (that desyncs a live
            // connector from an empty store entry).
            expect(mockConnectorInstance.rejectSession).toHaveBeenCalled()
            expect(mockSetConnectionError).toHaveBeenCalled()
            expect(mockSetConnections).not.toHaveBeenCalled()
        })

        it('should correctly filter only the rejected session when multiple exist', async () => {
            const connection1 = { clientId: 'client-multi-1' } as any
            const connection2 = { clientId: 'client-multi-2' } as any
            const connections = [connection1, connection2]

            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: connections,
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                await result.current.connect({ connection: connection1 })
                await result.current.connect({ connection: connection2 })
            })

            const mockConnectorInstance1 = (WalletConnect as any).mock.results[
                (WalletConnect as any).mock.results.length - 2
            ].value

            await act(async () => {
                await result.current.rejectSession('client-multi-1')
            })

            expect(mockConnectorInstance1.rejectSession).toHaveBeenCalled()
            expect(mockSetConnections).toHaveBeenCalledWith([connection2])
        })
    })

    describe('connectSessions', () => {
        it('establishes a connector for every stored session without writing the store back', async () => {
            const connection1 = { clientId: 'client1' } as any
            const connection2 = { clientId: 'client2' } as any
            const connections = [connection1, connection2]

            // Re-mock store implementation to return these sessions
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: connections,
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                result.current.connectSessions()
            })

            expect(WalletConnect).toHaveBeenCalledTimes(2)
            expect(getConnector('client1')).toBeDefined()
            expect(getConnector('client2')).toBeDefined()
            expect(mockSetConnections).not.toHaveBeenCalled()
        })

        it('is idempotent — a session that already has a connector is left untouched', async () => {
            const connection1 = { clientId: 'client1' } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection1],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                result.current.connectSessions()
                result.current.connectSessions()
            })

            expect(WalletConnect).toHaveBeenCalledTimes(1)
        })

        it('skips a stored connection whose connector construction throws, logging instead of leaking an unhandled rejection', async () => {
            const broken = { clientId: 'bad-no-bridge' } as any
            const valid = { clientId: 'good', bridge: 'wss://b.example' } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [broken, valid],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            // Mirror the WC v1 library: constructing a connector for a session
            // without a usable bridge throws synchronously.
            const originalImpl = (WalletConnect as any).getMockImplementation()
            ;(WalletConnect as any).mockImplementation(function (options: any) {
                if (options?.clientId === 'bad-no-bridge') {
                    throw new Error(
                        'Invalid or missing bridge url parameter value',
                    )
                }
                return {
                    on: vi.fn(),
                    off: vi.fn(),
                    killSession: vi.fn(),
                    approveSession: vi.fn(),
                    rejectSession: vi.fn(),
                    connected: false,
                    clientId: options?.clientId ?? 'mock-client-id',
                    session: {},
                }
            })

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                result.current.connectSessions()
                // let the fire-and-forget connect promises settle
                await Promise.resolve()
                await Promise.resolve()
            })
            ;(WalletConnect as any).mockImplementation(originalImpl)

            // The broken session is logged and skipped; the valid one still
            // registers, and the failure never escapes as an unhandled
            // rejection.
            expect(logger.error).toHaveBeenCalled()
            expect(getConnector('good')).toBeDefined()
            expect(getConnector('bad-no-bridge')).toBeUndefined()
        })

        it('should do nothing if connections is null', async () => {
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: null,
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                result.current.connectSessions()
            })

            expect(WalletConnect).not.toHaveBeenCalled()
            expect(mockSetConnections).not.toHaveBeenCalled()
        })
    })

    describe('deleteAllSessions', () => {
        it('should kill all sessions and clear store', async () => {
            const connection1 = { clientId: 'client1' } as any
            const connection2 = { clientId: 'client2' } as any
            const connections = [connection1, connection2]

            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: connections,
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            // We need connectors to be present to kill them
            // Inject connectors into the module scope map using a trick?
            // Since we can't easily access the private `connectors` map, we have to rely on `connect` to populate it.
            // But `deleteAllSessions` uses `disconnect` which checks the map.

            await act(async () => {
                await result.current.connect({
                    connection: { clientId: 'client1' },
                } as any)
                await result.current.connect({
                    connection: { clientId: 'client2' },
                } as any)
            })

            // The mocked WalletConnect returns a new object each time.

            await act(async () => {
                await result.current.deleteAllSessions()
            })

            expect(mockSetConnections).toHaveBeenCalledWith([])
        })

        it('should ignore sessions without clientId', async () => {
            // Sessions with no clientId
            const connections = [{ clientId: undefined }, { clientId: null }]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: connections,
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )

            await act(async () => {
                await result.current.deleteAllSessions()
            })

            // Should verify no disconnect calls made (hard to check on static/hidden map?)
            // verify setConnections called with empty
            expect(mockSetConnections).toHaveBeenCalledWith([])
        })
    })

    describe('error handling and edge cases', () => {
        it('should handle error event', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            await act(async () => {
                await result.current.connect({
                    connection: { clientId: 'test' },
                } as any)
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const errorCallback = mockConnectorInstance.on.mock.calls.find(
                (call: any) => call[0] === 'error',
            )[1]

            // Just ensure it doesn't crash
            errorCallback(new Error('test error'))
        })

        it('should reject when approving invalid session', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            await expect(
                result.current.approveSession('non-existent', {} as any, []),
            ).rejects.toThrow() // WalletConnectInvalidSessionError
        })

        it('surfaces the failure instead of throwing when rejecting an invalid session', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            // Rejection is user-initiated cleanup — it never traps the user,
            // even when the connector is gone.
            await expect(
                result.current.rejectSession('non-existent'),
            ).resolves.toBeUndefined()
            expect(mockSetConnectionError).toHaveBeenCalled()
        })

        it('should handle session_request error', async () => {
            const { result } = renderHook(() =>
                useWalletConnect(Networks.mainnet),
            )
            await act(async () => {
                await result.current.connect({
                    connection: { clientId: 'client-requesterror' },
                } as any)
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const sessionRequestCallback =
                mockConnectorInstance.on.mock.calls.find(
                    (call: any) => call[0] === 'session_request',
                )[1]

            sessionRequestCallback(new Error('fail'), null)
            // Should verify logger.error was called if possible but logger is mocked globally.
        })
    })
})
