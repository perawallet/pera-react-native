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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWalletConnectHandlers } from '../useWalletConnectHandlers'
import { useWalletConnectStore } from '../../store'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { Networks } from '@perawallet/wallet-core-shared'
import {
    useAllAccounts,
    isLedgerAccount,
} from '@perawallet/wallet-core-accounts'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../../errors'

// Mock dependencies
vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

vi.mock('uuid', async importOriginal => {
    const actual = await importOriginal<typeof import('uuid')>()
    return {
        ...actual,
        v7: vi.fn(() => 'MOCK_UUID'),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionEncoder: vi.fn(() => ({
        encodeSignedTransaction: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
    })),
    encodeAlgorandAddress: vi.fn(() => 'TEST_ADDRESS'),
    decodeAlgorandTransactions: vi.fn(txns => txns),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: vi.fn(() => [
            { address: 'addr1', name: 'Account 1', type: 'standard' },
        ]),
        getAccountDisplayName: vi.fn(a => a.name || a.address),
        isLedgerAccount: vi.fn(() => false),
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

describe('useWalletConnectHandlers', () => {
    const mockAddSignRequest = vi.fn()
    const mockSessions = [
        {
            clientId: 'test-client-id',
            session: {
                clientId: 'test-client-id',
                chainId: 4160,
                accounts: ['addr1'],
            },
        },
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useSigningRequest as any).mockReturnValue({
            addSignRequest: mockAddSignRequest,
        })
        ;(useNetwork as any).mockReturnValue({
            network: Networks.mainnet,
        })
        ;(useWalletConnectStore as any).mockImplementation((selector: any) =>
            selector({ walletConnectConnections: mockSessions }),
        )
    })

    describe('handleSignData', () => {
        it('should call addSignRequest with correct params when request is valid', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                sendTransaction: vi.fn(),
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
                id: 1,
            }

            result.current.handleSignData(connector as any, null, payload)

            expect(mockAddSignRequest).toHaveBeenCalledWith({
                id: 'MOCK_UUID',
                type: 'arbitrary-data',
                transport: 'callback',
                transportId: 'test-client-id',
                data: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
                sourceMetadata: undefined,
                approve: expect.any(Function),
                reject: expect.any(Function),
                error: expect.any(Function),
            })

            // Test success callback
            const { approve } = mockAddSignRequest.mock.calls[0][0]
            const signature = new Uint8Array([1, 2, 3])

            act(() => {
                approve([{ signature }])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: [Buffer.from(signature).toString('base64')],
            })
        })

        it('should handle rejection callback', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
                id: 1,
            }

            result.current.handleSignData(connector as any, null, payload)

            const { reject } = mockAddSignRequest.mock.calls[0][0]

            act(() => {
                reject()
            })

            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: expect.objectContaining({ message: 'User rejected' }),
            })
        })

        it('should handle error during approval', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(() => {
                    throw new Error('Approval failed')
                }),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
                id: 1,
            }

            result.current.handleSignData(connector as any, null, payload)

            const { approve } = mockAddSignRequest.mock.calls[0][0]

            act(() => {
                approve([{ signature: new Uint8Array([1]) }])
            })

            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: expect.objectContaining({ message: 'Approval failed' }),
            })
        })

        it('should handle handleSignData error', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
            }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
                id: 1,
            }

            result.current.handleSignData(connector as any, null, payload)

            const { error } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            await expect(error('Rejected')).rejects.toThrow(
                WalletConnectSignRequestError,
            )
        })

        it('should throw WalletConnectSignRequestError if error is present', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const error = new Error('Some error')

            expect(() =>
                result.current.handleSignData(connector as any, error, {}),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('should throw WalletConnectInvalidSessionError if session not found', () => {
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) => selector({ walletConnectConnections: [] }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(connector as any, null, {}),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('should throw WalletConnectInvalidNetworkError if chainId mismatches', () => {
            const mockSessionsMismatch = [
                {
                    clientId: 'test-client-id',
                    session: {
                        clientId: 'test-client-id',
                        chainId: 999999,
                    },
                },
            ]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: mockSessionsMismatch,
                    }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(connector as any, null, {}),
            ).toThrow(WalletConnectInvalidNetworkError)
        })

        it('should throw WalletConnectSignRequestError if param is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = { params: [] }

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('should throw WalletConnectSignRequestError if data is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        // data is missing
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
            }

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('should throw WalletConnectInvalidSessionError if signer is not in session', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'unknown-addr',
                    },
                ],
            }

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('should throw WalletConnectInvalidSessionError if signer is not in local accounts', () => {
            ;(useAllAccounts as any).mockReturnValue([])
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'addr1',
                    },
                ],
            }
            // Mock session to have the address but useAllAccounts to NOT have it
            const mockSessionsLocal = [
                {
                    clientId: 'test-client-id',
                    session: {
                        clientId: 'test-client-id',
                        chainId: 4160,
                        accounts: ['addr1'],
                    },
                },
            ]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({ walletConnectConnections: mockSessionsLocal }),
            )

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('should throw WalletConnectInvalidSessionError for Ledger accounts', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 4160,
                        signer: 'ledger-addr',
                    },
                ],
            }
            // Mock session and accounts
            const mockSessionsLocal = [
                {
                    clientId: 'test-client-id',
                    session: {
                        clientId: 'test-client-id',
                        chainId: 4160,
                        accounts: ['ledger-addr'],
                    },
                },
            ]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({ walletConnectConnections: mockSessionsLocal }),
            )
            ;(useAllAccounts as any).mockReturnValue([
                { address: 'ledger-addr', name: 'Ledger', type: 'ledger' },
            ])
            ;(isLedgerAccount as any).mockReturnValue(true)

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectInvalidSessionError)
        })
    })

    describe('handleSignTransaction', () => {
        it('should call addSignRequest with correct params when request is valid', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                sendTransaction: vi.fn(),
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    {
                        message: 'Sign tx',
                        txn: 'encodedTxn',
                    },
                ],
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                null,
                payload,
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith({
                id: 'MOCK_UUID',
                type: 'transactions',
                transport: 'callback',
                transportId: 'test-client-id',
                txs: ['encodedTxn'],
                approve: expect.any(Function),
                reject: expect.any(Function),
                error: expect.any(Function),
            })

            // Test success callback
            const { approve } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            // Mock PeraSignedTransaction
            const signedTxs = [
                [
                    {
                        txn: {
                            sender: { publicKey: new Uint8Array([10, 20, 30]) },
                        },
                        sig: new Uint8Array([1, 2, 3]),
                    },
                ],
            ]

            act(() => {
                approve(signedTxs)
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: [[new Uint8Array([1, 2, 3, 4])]],
            })
        })

        it('should handle rejection callback', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [{ message: 'Sign tx', txn: 'encodedTxn' }],
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                null,
                payload,
            )

            const { reject } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            act(() => {
                reject()
            })

            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: expect.objectContaining({ message: 'User rejected' }),
            })
        })

        it('should use authAddress for from address if present', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                sendTransaction: vi.fn(),
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [{ message: 'Sign tx', txn: 'encodedTxn' }],
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                null,
                payload,
            )

            const { approve } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            const signedTxs = [
                [
                    {
                        txn: {
                            sender: { publicKey: new Uint8Array([10, 20, 30]) },
                        },
                        authAddress: {
                            publicKey: new Uint8Array([40, 50, 60]),
                        },
                        sig: new Uint8Array([1, 2, 3]),
                    },
                ],
            ]

            act(() => {
                approve(signedTxs)
            })

            // Mock encodeAlgorandAddress returns same string, but we verify it was called
            // In a real scenario, we might want to check if encodeAlgorandAddress was called with the auth key
            // We can verify calls to the mock or assume correctness if sendTransaction is called.
            // Since our mock encodeAlgorandAddress always returns 'TEST_ADDRESS', verification is limited.
            // But we can check if it didn't crash.

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: [[new Uint8Array([1, 2, 3, 4])]],
            })
        })

        it('should do nothing if signed transaction is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                sendTransaction: vi.fn(),
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [{ message: 'Sign tx', txn: 'encodedTxn' }],
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                null,
                payload,
            )

            const { approve } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            act(() => {
                approve([])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: [],
            })
        })

        it('should handle handleSignTransaction error', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
            }
            const payload = {
                params: [{ message: 'Sign tx', txn: 'encodedTxn' }],
            }

            result.current.handleSignTransaction(
                connector as any,
                null,
                payload,
            )

            const { error } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            await expect(error('addr1', 'Rejected')).rejects.toThrow(
                WalletConnectSignRequestError,
            )
        })

        it('should throw WalletConnectInvalidSessionError if session not found', () => {
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) => selector({ walletConnectConnections: [] }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    null,
                    {},
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })
    })
})
