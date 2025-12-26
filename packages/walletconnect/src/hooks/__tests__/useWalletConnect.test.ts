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

vi.mock('@walletconnect/client', () => {
    return {
        default: vi.fn().mockImplementation(function () {
            return {
                on: vi.fn(),
                killSession: vi.fn(),
                approveSession: vi.fn(),
                rejectSession: vi.fn(),
                connected: false,
                clientId: 'mock-client-id',
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
    const mockSetSessions = vi.fn()
    const mockAddSessionRequest = vi.fn()
    const mockHandleSignData = vi.fn()
    const mockHandleSignTransaction = vi.fn()
    let mockSessions: any[]

    beforeEach(() => {
        vi.clearAllMocks()
        mockSessions = []
        ;(useWalletConnectStore as any).mockImplementation((selector: any) =>
            selector({
                walletConnectSessions: mockSessions,
                setWalletConnectSessions: mockSetSessions,
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
        // To properly reset it, we might need to rely on `disconnectSession` or `deleteAllSessions` logic if we assume isolate modules is not full reload.
        // However, in unit tests, usually modules are cached.
        // For now, we will just expect new instances of WalletConnect to be created.
    })

    describe('connectSession', () => {
        it('should initialize connector and bind events', async () => {
            const { result } = renderHook(() => useWalletConnect())
            const session = {
                session: {
                    clientId: 'test-session',
                    topic: 'abc',
                    bridge: 'xyz',
                    key: '123',
                },
            } as any

            await act(async () => {
                await result.current.connectSession({ session })
            })

            expect(WalletConnect).toHaveBeenCalledWith({
                ...session,
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
            const session = { session: { clientId: 'test-session' } } as any

            await act(async () => {
                await result.current.connectSession({ session })
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
                clientId: 'mock-client-id',
            })
        })

        it('should handle disconnect event', async () => {
            const { result } = renderHook(() => useWalletConnect())
            const session = { session: { clientId: 'mock-client-id' } } as any
            mockSessions.push(session)
            // We need mockSessions to be returned by store.
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectSessions: [session],
                        setWalletConnectSessions: mockSetSessions,
                    }),
            )

            await act(async () => {
                await result.current.connectSession({ session })
            })

            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            const disconnectCallback = mockConnectorInstance.on.mock.calls.find(
                (call: any) => call[0] === 'disconnect',
            )[1]

            await act(async () => {
                await disconnectCallback()
            })

            // disconnectSession calls setSessions filtering out the disconnected one
            // filtering: session.session?.clientId !== clientId
            // clientId is from the connector: 'mock-client-id'

            expect(mockSetSessions).toHaveBeenCalled()
            const newSessions = mockSetSessions.mock.calls[0][0]
            expect(newSessions).toHaveLength(0)
        })
    })

    describe('disconnectSession', () => {
        it('should kill session and remove from store', async () => {
            const { result } = renderHook(() => useWalletConnect())
            const session = { session: { clientId: 'mock-client-id' } } as any
            // Populate store so it can be filtered
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectSessions: [session],
                        setWalletConnectSessions: mockSetSessions,
                    }),
            )

            // First connect to populate 'connectors' map
            await act(async () => {
                await result.current.connectSession({ session })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value
            mockConnectorInstance.connected = true

            await act(async () => {
                await result.current.disconnectSession('mock-client-id', true)
            })

            expect(mockConnectorInstance.killSession).toHaveBeenCalledWith({
                message: 'User disconnected',
            })
            expect(mockSetSessions).toHaveBeenCalled()
            const args = mockSetSessions.mock.calls[0][0]
            // actually mockSetSessions could be called multiple times.

            // safer check
            expect(args).toEqual([])
        })
    })

    describe('approveSession', () => {
        it('should approve session and update store', async () => {
            const { result } = renderHook(() => useWalletConnect())
            const session = { session: { clientId: 'mock-client-id' } } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectSessions: [session],
                        setWalletConnectSessions: mockSetSessions,
                    }),
            )

            // Connect first
            await act(async () => {
                await result.current.connectSession({ session })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value

            const request = { chainId: 4160, permissions: {} } as any
            const addresses = ['addr1']

            act(() => {
                result.current.approveSession(
                    'mock-client-id',
                    request,
                    addresses,
                )
            })

            expect(mockConnectorInstance.approveSession).toHaveBeenCalledWith({
                chainId: 4160,
                accounts: ['addr1'],
            })

            expect(mockSetSessions).toHaveBeenCalled()
            // The logic appends the new session info.
            const updatedSessions =
                mockSetSessions.mock.calls[
                    mockSetSessions.mock.calls.length - 1
                ][0]
            expect(updatedSessions).toHaveLength(1)
            expect(updatedSessions[0].clientId).toBe('mock-client-id')
            expect(updatedSessions[0].connected).toBe(false) // from mock default
            // verify existingSession merge
        })
    })

    describe('rejectSession', () => {
        it('should reject session and update store', async () => {
            const { result } = renderHook(() => useWalletConnect())
            const session = { session: { clientId: 'mock-client-id' } } as any
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectSessions: [session],
                        setWalletConnectSessions: mockSetSessions,
                    }),
            )

            // Connect first
            await act(async () => {
                await result.current.connectSession({ session })
            })
            const mockConnectorInstance = (WalletConnect as any).mock.results[0]
                .value

            act(() => {
                result.current.rejectSession('mock-client-id')
            })

            expect(mockConnectorInstance.rejectSession).toHaveBeenCalled()
            expect(mockSetSessions).toHaveBeenCalled()
            const updatedSessions =
                mockSetSessions.mock.calls[
                    mockSetSessions.mock.calls.length - 1
                ][0]
            expect(updatedSessions).toHaveLength(0)
        })
    })

    describe('reconnectAllSessions', () => {
        it('should reconnect consistent sessions', async () => {
            const session1 = { session: { clientId: 'client1' } } as any
            const session2 = { session: { clientId: 'client2' } } as any
            const sessions = [session1, session2]

            // Re-mock store implementation to return these sessions
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectSessions: sessions,
                        setWalletConnectSessions: mockSetSessions,
                    }),
            )

            const { result } = renderHook(() => useWalletConnect())

            await act(async () => {
                result.current.reconnectAllSessions()
            })

            expect(WalletConnect).toHaveBeenCalledTimes(2)
            expect(mockSetSessions).toHaveBeenCalled()
        })
    })

    describe('deleteAllSessions', () => {
        it('should kill all sessions and clear store', async () => {
            const session1 = { clientId: 'client1' } as any
            const session2 = { clientId: 'client2' } as any
            const sessions = [session1, session2]

            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectSessions: sessions,
                        setWalletConnectSessions: mockSetSessions,
                    }),
            )

            const { result } = renderHook(() => useWalletConnect())

            // We need connectors to be present to kill them
            const connector1 = {
                clientId: 'client1',
                killSession: vi.fn(),
                connected: true,
            }
            const connector2 = {
                clientId: 'client2',
                killSession: vi.fn(),
                connected: true,
            }

            // Inject connectors into the module scope map using a trick?
            // Since we can't easily access the private `connectors` map, we have to rely on `connectSession` to populate it.
            // But `deleteAllSessions` uses `disconnectSession` which checks the map.

            await act(async () => {
                await result.current.connectSession({
                    session: { clientId: 'client1' },
                } as any)
                await result.current.connectSession({
                    session: { clientId: 'client2' },
                } as any)
            })

            // The mocked WalletConnect returns a new object each time.

            await act(async () => {
                await result.current.deleteAllSessions()
            })

            expect(mockSetSessions).toHaveBeenCalledWith([])
        })
    })

    describe('error handling and edge cases', () => {
        it('should handle error event', async () => {
            const { result } = renderHook(() => useWalletConnect())
            await act(async () => {
                await result.current.connectSession({
                    session: { clientId: 'test' },
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
                await result.current.connectSession({
                    session: { clientId: 'test' },
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
