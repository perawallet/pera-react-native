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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useWalletConnect } from '../useWalletConnect'
import { useWalletConnectStore } from '../../store'
import { useWalletConnectSessionRequests } from '../useWalletConnectSessionRequests'
import useWalletConnectHandlers from '../useWalletConnectHandlers'
import WalletConnect from '@walletconnect/client'
import { PERA_CLIENT_META } from '../../constants'

// Mock dependencies
vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

vi.mock('../useWalletConnectSessionRequests', () => ({
    useWalletConnectSessionRequests: vi.fn(),
}))

vi.mock('../useWalletConnectHandlers', () => ({
    default: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@walletconnect/client', () => {
    return {
        default: vi.fn().mockImplementation(function (options) {
            return {
                on: vi.fn(),
                off: vi.fn(),
                killSession: vi.fn(),
                approveSession: vi.fn(),
                rejectSession: vi.fn(),
                connected: false,
                clientId: options?.clientId || 'mock-client-id',
                session: {},
            }
        }),
    }
})

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-shared')
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(actual as any),
        logger: {
            debug: vi.fn(),
            error: vi.fn(),
        },
    }
})

describe('useWalletConnect', () => {
    const mockSetConnections = vi.fn()
    const mockAddSessionRequest = vi.fn()
    const mockHandleSignData = vi.fn()
    const mockHandleSignTransaction = vi.fn()
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
        ;(useWalletConnectSessionRequests as any).mockReturnValue({
            addSessionRequest: mockAddSessionRequest,
        })
        ;(useWalletConnectHandlers as any).mockReturnValue({
            handleSignData: mockHandleSignData,
            handleSignTransaction: mockHandleSignTransaction,
        })
    })

    afterEach(() => {
        // Clear static connectors map in the hook module?
        // The hook uses a module-level variable `connectors`.
        // To properly reset it, we might need to rely on `disconnect` or `deleteAllSessions` logic if we assume isolate modules is not full reload.
        // However, in unit tests, usually modules are cached.
        // For now, we will just expect new instances of WalletConnect to be created.
    })

    describe('connect', () => {
        it('should initialize connector and bind events', async () => {
            const { result } = renderHook(() => useWalletConnect())
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
            const { result } = renderHook(() => useWalletConnect())
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

        it('should auto-approve session if autoConnect is true', async () => {
            const { result } = renderHook(() => useWalletConnect())
            const connection = {
                clientId: 'client-auto',
                autoConnect: true,
            } as any

            // Must mock store to return specific session or assume passed session is enough for autoConnect logic?
            // The logic: if (session.autoConnect) { approveSession(...) }
            // references 'session' from closure scope of 'connect'.
            // Yes, passes 'session' arg.

            // Also needs accounts to be present for approveSession
            // useAllAccounts mock returns [] by default (line 36)

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

            // We need to spy on approveSession of the *hook* or check if connector.approveSession is called.
            // But approveSession in hook logic calls `approveSession(clientId, ...)`
            // Wait, line 62 in useWalletConnect.ts calls `approveSession(...)` (the hook function).
            // It calls the internal `approveSession` function defined in the hook.
            // Which then calls `connector.approveSession`.

            // However, `approveSession` requires the session to be in the store to find it (lines 140-142).
            // So we must put the session in the store.
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: [connection],
                        setWalletConnectConnections: mockSetConnections,
                    }),
            )

            act(() => {
                sessionRequestCallback(null, payload)
            })

            expect(mockAddSessionRequest).not.toHaveBeenCalled()
            expect(mockConnectorInstance.approveSession).toHaveBeenCalledWith({
                chainId: 4160,
                accounts: [],
            })
        })

        it('should trigger handleSignData on algo_signData event', async () => {
            const { result } = renderHook(() => useWalletConnect())
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
                error,
                payload,
            )
        })

        it('should trigger handleSignTransaction on algo_signTxn event', async () => {
            const { result } = renderHook(() => useWalletConnect())
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
                error,
                payload,
            )
        })

        it('should handle disconnect event', async () => {
            const { result } = renderHook(() => useWalletConnect())
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
            const { result } = renderHook(() => useWalletConnect())
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
            const { result } = renderHook(() => useWalletConnect())
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

            act(() => {
                result.current.approveSession(
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
    })

    describe('rejectSession', () => {
        it('should reject session and update store', async () => {
            const { result } = renderHook(() => useWalletConnect())
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

            act(() => {
                result.current.rejectSession('client-reject')
            })

            expect(mockConnectorInstance.rejectSession).toHaveBeenCalled()
            expect(mockSetConnections).toHaveBeenCalled()
            const updatedConnections =
                mockSetConnections.mock.calls[
                    mockSetConnections.mock.calls.length - 1
                ][0]
            expect(updatedConnections).toHaveLength(0)
        })
    })

    describe('reconnectAllSessions', () => {
        it('should reconnect consistent sessions', async () => {
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

            const { result } = renderHook(() => useWalletConnect())

            await act(async () => {
                result.current.reconnectAllSessions()
            })

            // 2 calls from initWalletConnect (on mount). Manual reconnectAllSessions reuses existing connectors so no new calls.
            expect(WalletConnect).toHaveBeenCalledTimes(2)
            expect(mockSetConnections).toHaveBeenCalled()
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

            const { result } = renderHook(() => useWalletConnect())

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

            const { result } = renderHook(() => useWalletConnect())

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
            const { result } = renderHook(() => useWalletConnect())
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

        it('should throw when approving invalid session', () => {
            const { result } = renderHook(() => useWalletConnect())
            expect(() => {
                result.current.approveSession('non-existent', {} as any, [])
            }).toThrow() // WalletConnectInvalidSessionError
        })

        it('should throw when rejecting invalid session', () => {
            const { result } = renderHook(() => useWalletConnect())
            expect(() => {
                result.current.rejectSession('non-existent')
            }).toThrow() // WalletConnectInvalidSessionError
        })

        it('should handle session_request error', async () => {
            const { result } = renderHook(() => useWalletConnect())
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
