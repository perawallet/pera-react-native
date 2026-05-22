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
import { ensureConnectorReady } from '../../connection'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import {
    generateOrderedUniqueId,
    Networks,
} from '@perawallet/wallet-core-shared'
import {
    canSignArbitraryData,
    useAllAccounts,
    useSigningAccounts,
    isHardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../../errors'
import { WalletConnectTransactionPayload } from 'walletconnect/src/models'

// Mock dependencies
vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

vi.mock('../../connection', () => ({
    ensureConnectorReady: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionEncoder: vi.fn(() => ({
        encodeSignedTransaction: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
        encodeSignedTransactions: vi.fn((txs: unknown[]) =>
            txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
        ),
        decodeTransactions: vi.fn((txnBytes: Uint8Array[]) =>
            txnBytes.map(() => ({
                sender: {
                    publicKey: new Uint8Array([1, 2, 3]),
                    toString: () => 'addr1',
                },
                fee: 1000n,
            })),
        ),
    })),
    encodeAlgorandAddress: vi.fn(() => 'TEST_ADDRESS'),
    useNetwork: vi.fn(),
    validateArc0001SignTxnParams: vi.fn(() => null),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
    resolveSignableTransactions: vi.fn(
        (
            txParams: { signers?: string[] }[],
            txSenders: string[],
            signableAddresses: Set<string>,
            multisigAddresses: ReadonlySet<string> = new Set(),
        ) => {
            const indicesToSign: number[] = []
            const signerOverrides = new Map<number, string>()
            for (let i = 0; i < txParams.length; i++) {
                const param = txParams[i]
                const txSender = txSenders[i]
                if (param.signers && param.signers.length === 0) continue
                // Mirror production: multisig sender short-circuits the
                // signers override and routes through the propose flow.
                if (multisigAddresses.has(txSender)) {
                    indicesToSign.push(i)
                    continue
                }
                if (param.signers && param.signers.length > 0) {
                    const match = param.signers.find(s =>
                        signableAddresses.has(s),
                    )
                    if (match) {
                        const txsIndex = indicesToSign.length
                        indicesToSign.push(i)
                        if (match !== txSender)
                            signerOverrides.set(txsIndex, match)
                    }
                    continue
                }
                if (signableAddresses.has(txSender)) indicesToSign.push(i)
            }
            return { indicesToSign, signerOverrides }
        },
    ),
}))

vi.mock('@perawallet/wallet-core-accounts', () => {
    const canSignArbitraryData = vi.fn(() => true)
    const isHardwareWalletAccount = vi.fn(() => false)
    return {
        useAllAccounts: vi.fn(() => [
            { address: 'addr1', name: 'Account 1', type: 'standard' },
        ]),
        useSigningAccounts: vi.fn(() => [
            { address: 'addr1', name: 'Account 1', type: 'standard' },
        ]),
        canSignWith: vi.fn(() => true),
        canSignArbitraryData,
        // Mirror the real composition so tests that toggle the two predicates
        // exercise canSignArc60 without setting it directly.
        canSignArc60: vi.fn(
            (a: any) => canSignArbitraryData(a) || isHardwareWalletAccount(a),
        ),
        getAccountDisplayName: vi.fn((a: any) => a.name || a.address),
        isHardwareWalletAccount,
        isMultisigAccount: vi.fn((a: any) => a?.type === 'multisig'),
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
        decodeFromBase64: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
        encodeToBase64: vi.fn(() => 'AQIDBA=='),
        generateOrderedUniqueId: vi.fn(() => 'MOCK_UUID'),
    }
})

describe('useWalletConnectHandlers', () => {
    const mockAddSignRequest = vi.fn()
    const mockSetConnectionError = vi.fn()
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
        ;(useAllAccounts as any).mockReturnValue([
            { address: 'addr1', name: 'Account 1', type: 'standard' },
        ])
        ;(isHardwareWalletAccount as any).mockReturnValue(false)
        ;(useTransactionEncoder as any).mockImplementation(() => ({
            encodeSignedTransaction: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
            encodeSignedTransactions: vi.fn((txs: unknown[]) =>
                txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
            ),
            decodeTransactions: vi.fn((txnBytes: Uint8Array[]) =>
                txnBytes.map(() => ({
                    sender: {
                        publicKey: new Uint8Array([1, 2, 3]),
                        toString: () => 'addr1',
                    },
                    fee: 1000n,
                })),
            ),
        }))
        ;(useSigningRequest as any).mockReturnValue({
            addSignRequest: mockAddSignRequest,
            removeSignRequest: vi.fn(),
            clearLastFailedRequest: vi.fn(),
        })
        ;(useNetwork as any).mockReturnValue({
            network: Networks.mainnet,
        })
        ;(useWalletConnectStore as any).mockImplementation((selector: any) =>
            selector({ walletConnectConnections: mockSessions }),
        )
        ;(useWalletConnectStore as any).getState = () => ({
            setConnectionError: mockSetConnectionError,
        })
        // Default: delivery callbacks resolve to a generic ready connector.
        // Tests that assert on a specific connector override this with
        // `mockResolvedValue(connector)`.
        ;(ensureConnectorReady as any).mockResolvedValue({
            approveRequest: vi.fn(),
            rejectRequest: vi.fn(),
        })
    })

    describe('handleSignData', () => {
        it('should call addSignRequest with correct params when request is valid', async () => {
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

            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith({
                id: 'MOCK_UUID',
                type: 'arbitrary-data',
                transport: 'callback',
                sourceType: 'walletconnect',
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

            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            await act(async () => {
                await approve([{ signature }])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA=='], // Mocked encodeToBase64 return value
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

            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]

            act(() => {
                reject()
            })

            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: expect.objectContaining({ message: 'User rejected' }),
            })
        })

        it('propagates the error when approveRequest throws', async () => {
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

            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { approve } = mockAddSignRequest.mock.calls[0][0]
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            // The approve callback no longer swallows delivery failures —
            // it rejects so the signing pipeline surfaces an honest
            // failure instead of reporting a false success.
            await expect(
                approve([{ signature: new Uint8Array([1]) }]),
            ).rejects.toThrow('Approval failed')
        })

        it('should handle handleSignData error', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
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

            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { error } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            const incomingError = new Error('Rejected')
            await error(incomingError)

            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: incomingError,
            })
            expect(mockSetConnectionError).toHaveBeenCalledWith(
                expect.any(WalletConnectSignRequestError),
            )
        })

        it('should throw WalletConnectSignRequestError if error is present', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const error = new Error('Some error')

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    error,
                    {},
                ),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('should throw WalletConnectInvalidSessionError if session not found', () => {
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) => selector({ walletConnectConnections: [] }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    {},
                ),
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
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    {},
                ),
            ).toThrow(WalletConnectInvalidNetworkError)
        })

        it('should allow 416002 chainId when network is testnet', () => {
            const mockSessionsTestnet = [
                {
                    clientId: 'test-client-id',
                    session: {
                        clientId: 'test-client-id',
                        chainId: 416002,
                        accounts: ['addr1'],
                    },
                },
            ]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({
                        walletConnectConnections: mockSessionsTestnet,
                    }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                        chainId: 416002,
                        signer: 'addr1',
                    },
                ],
            }

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.testnet,
                    null,
                    payload,
                ),
            ).not.toThrow()
        })

        it('should throw WalletConnectInvalidNetworkError if chainId is 416001 when network is testnet', () => {
            const mockSessionsMismatch = [
                {
                    clientId: 'test-client-id',
                    session: {
                        clientId: 'test-client-id',
                        chainId: 416001,
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
                result.current.handleSignData(
                    connector as any,
                    Networks.testnet,
                    null,
                    {},
                ),
            ).toThrow(WalletConnectInvalidNetworkError)
        })

        it('should throw WalletConnectSignRequestError if param is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = { params: [] }

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    payload,
                ),
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
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    payload,
                ),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('throws WalletConnectSignRequestError when the payload has no data at all', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    { params: null },
                ),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('throws WalletConnectSignRequestError when params is an empty array', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    { params: [] },
                ),
            ).toThrow(WalletConnectSignRequestError)
        })
    })

    describe('handleSignData (ARC-60)', () => {
        const arc60Payload = (overrides: Record<string, unknown> = {}) => ({
            id: 42,
            params: {
                data: 'aGVsbG8=',
                signer: 'addr1',
                domain: 'example.com',
                authenticatorData: 'YXV0aA==',
                metadata: { scope: 1, encoding: 'utf-8' },
                ...overrides,
            },
        })

        it('routes to the ARC-60 handler and queues an arc60 sign request', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            result.current.handleSignData(
                connector,
                Networks.mainnet,
                null,
                arc60Payload(),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arc60',
                    transport: 'callback',
                    sourceType: 'walletconnect',
                }),
            )
        })

        it('queues an arc60 sign request for a Ledger (hardware) signer', () => {
            // Hardware accounts can't sign locally (`canSignArbitraryData`
            // false) but DO sign ARC-60 on-device via the hardware strategy,
            // so the ARC-60 gate must let them through.
            ;(canSignArbitraryData as any).mockReturnValue(false)
            ;(isHardwareWalletAccount as any).mockReturnValue(true)
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Ledger',
                    type: 'hardware',
                    hardwareDetails: {
                        manufacturer: 'ledger',
                        deviceId: 'test-device',
                        deviceName: 'Ledger Nano X',
                        accountIndex: 0,
                        transportType: 'ble',
                    },
                },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload(),
                ),
            ).not.toThrow()

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'arc60' }),
            )
        })

        it('throws WalletConnectSignRequestError when the payload fails schema validation', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            const bad = arc60Payload({ signer: '' })
            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    bad,
                ),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('throws WalletConnectInvalidSessionError when ARC-60 signer is not in the session', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            const bad = arc60Payload({ signer: 'unknown-addr' })
            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    bad,
                ),
            ).toThrow(WalletConnectInvalidSessionError)
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
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    payload,
                ),
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
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    payload,
                ),
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
                {
                    address: 'ledger-addr',
                    name: 'Ledger',
                    type: 'hardware',
                    hardwareDetails: {
                        manufacturer: 'ledger',
                        deviceId: 'test-device',
                        deviceName: 'Ledger Nano X',
                        accountIndex: 0,
                        transportType: 'ble',
                    },
                },
            ])
            ;(isHardwareWalletAccount as any).mockReturnValue(true)

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    payload,
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })
    })

    describe('handleSignTransaction', () => {
        it('should call addSignRequest with correct params when request is valid', async () => {
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
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith({
                id: 'MOCK_UUID',
                type: 'transactions',
                transport: 'callback',
                sourceType: 'walletconnect',
                transportId: 'test-client-id',
                txs: [
                    expect.objectContaining({
                        fee: 1000n,
                    }),
                ],
                groupContext: expect.any(Array),
                rawTransactionsBase64: expect.any(Array),
                sourceMetadata: undefined,
                approve: expect.any(Function),
                reject: expect.any(Function),
                error: expect.any(Function),
                approveSignedBytes: expect.any(Function),
            })

            // Test success callback
            const { approve } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            // Mock PeraSignedTransaction (flat array)
            const signedTxs = [
                {
                    txn: {
                        sender: { publicKey: new Uint8Array([10, 20, 30]) },
                    },
                    sig: new Uint8Array([1, 2, 3]),
                },
            ]

            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            await act(async () => {
                await approve(signedTxs)
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA=='],
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
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
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

        it('should use authAddress for from address if present', async () => {
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
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
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

            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            await act(async () => {
                await approve(signedTxs)
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA=='],
            })
        })

        it('should do nothing if signed transaction is missing', async () => {
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
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { approve } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            await act(async () => {
                await approve([])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: [null],
            })
        })

        it('should handle handleSignTransaction error', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { error } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]

            const incomingError = new Error('Rejected')
            await error(incomingError)

            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: incomingError,
            })
            expect(mockSetConnectionError).toHaveBeenCalledWith(
                expect.any(WalletConnectSignRequestError),
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
                    Networks.mainnet,
                    null,
                    {} as unknown as WalletConnectTransactionPayload,
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('should exclude transactions with signers: [] from sign request', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        { txn: 'signable-txn', message: 'Sign this' },
                        { txn: 'skip-txn', signers: [] },
                        { txn: 'signable-txn-2' },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            // Only 2 transactions should be in the sign request (indices 0 and 2)
            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(2)
        })

        it('should return full-length result array with null at skipped positions', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        { txn: 'signable-txn' },
                        { txn: 'skip-txn', signers: [] },
                        { txn: 'skip-txn-2', signers: [] },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { approve } = mockAddSignRequest.mock.calls[0][0]
            const signedTxs = [
                { txn: { sender: {} }, sig: new Uint8Array([1]) },
            ]

            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            await act(async () => {
                await approve(signedTxs)
            })

            // Result should be length 3: signed at index 0, null at indices 1 and 2
            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA==', null, null],
            })
        })

        it('should approve with all-null array when all transactions have signers: []', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            const payload = {
                params: [
                    [
                        { txn: 'skip-txn-1', signers: [] },
                        { txn: 'skip-txn-2', signers: [] },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            // Should not call addSignRequest
            expect(mockAddSignRequest).not.toHaveBeenCalled()

            // The all-null response is delivered through ensureConnectorReady.
            await vi.waitFor(() =>
                expect(connector.approveRequest).toHaveBeenCalledWith({
                    id: 1,
                    result: [null, null],
                }),
            )
        })

        it('should include transactions with non-empty signers array matching a user account', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        { txn: 'txn-with-signer', signers: ['addr1'] },
                        { txn: 'txn-no-signers' },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            // Both transactions should be included
            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(2)
        })

        it('should exclude transactions with non-user sender when signers is absent', () => {
            // This is the core fix for Folks Finance: contract-sender txns
            // without signers field should be skipped
            ;(useTransactionEncoder as any).mockImplementation(() => ({
                encodeSignedTransactions: vi.fn((txs: unknown[]) =>
                    txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
                ),
                decodeTransactions: vi.fn(() => [
                    {
                        sender: { toString: () => 'addr1' },
                        fee: 1000n,
                    },
                    {
                        sender: { toString: () => 'CONTRACT_ADDR' },
                        fee: 1000n,
                    },
                    {
                        sender: { toString: () => 'addr1' },
                        fee: 1000n,
                    },
                ]),
            }))

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        { txn: 'user-txn-1' },
                        { txn: 'contract-txn' }, // no signers, non-user sender
                        { txn: 'user-txn-2' },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            // Only 2 transactions (user-owned) should be in the sign request
            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(2)
        })

        it('should set signerOverrides when signers field differs from sender', () => {
            ;(useTransactionEncoder as any).mockImplementation(() => ({
                encodeSignedTransactions: vi.fn((txs: unknown[]) =>
                    txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
                ),
                decodeTransactions: vi.fn(() => [
                    {
                        sender: { toString: () => 'CONTRACT_ADDR' },
                        fee: 1000n,
                    },
                ]),
            }))

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        {
                            txn: 'contract-txn',
                            signers: ['addr1'], // user should sign, but sender is contract
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(1)
            expect(signRequest.signerOverrides).toEqual(new Map([[0, 'addr1']]))
        })

        it('should exclude transactions with signers containing only unknown addresses', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            const payload = {
                params: [
                    [
                        {
                            txn: 'txn',
                            signers: ['UNKNOWN_ADDR'],
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            // No user address matches → all filtered → approve with all-null
            expect(mockAddSignRequest).not.toHaveBeenCalled()
            // The all-null response is delivered through ensureConnectorReady.
            await vi.waitFor(() =>
                expect(connector.approveRequest).toHaveBeenCalledWith({
                    id: 1,
                    result: [null],
                }),
            )
        })

        it('forwards the full pre-filter payload as groupContext so the pipeline can validate atomic-group integrity', () => {
            // Regression: the signing pipeline validates atomic-group
            // integrity by recomputing the group hash. `txs` only carries
            // this wallet's signable subset, so the request must also
            // expose the original payload via `groupContext` — otherwise
            // legitimate cross-account groups (express-send shape, where
            // each side only signs half the group) would fail validation.
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        // Tx 0: signed by user
                        { message: 'user', txn: 'encodedTxn0' },
                        // Tx 1: dApp-signed (signers: []) — excluded from
                        // `txs` but must still appear in `groupContext`
                        // so the validator can recompute the group hash.
                        { message: 'dapp', txn: 'encodedTxn1', signers: [] },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            const sentRequest = mockAddSignRequest.mock.calls[0][0]
            expect(sentRequest.txs).toHaveLength(1)
            expect(sentRequest.groupContext).toHaveLength(2)
        })

        it('should propagate error when addSignRequest throws for over-limit transactions', () => {
            mockAddSignRequest.mockImplementation(() => {
                throw new Error('Transaction limit exceeded')
            })
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    Networks.mainnet,
                    null,
                    payload,
                ),
            ).toThrow('Transaction limit exceeded')
        })

        it('routes a multisig-sender tx with signers: [P1] through the propose flow (no signerOverrides)', () => {
            // Regression: the dApp can name a single participant in
            // `signers`, but the wallet must still sign with every local
            // participant of the multisig (which the propose transport
            // dispatches). Routing depends on `multisigAddresses` reaching
            // `resolveSignableTransactions` at the call site — previously
            // unwired in prod.
            mockAddSignRequest.mockReset()
            ;(useAllAccounts as any).mockReturnValue([
                { address: 'addr1', name: 'Participant', type: 'standard' },
                {
                    address: 'MSIG_ADDR',
                    name: 'Multisig',
                    type: 'multisig',
                    multisigDetails: {
                        version: 1,
                        threshold: 2,
                        addresses: ['addr1', 'P2', 'P3'],
                    },
                },
            ])
            ;(useTransactionEncoder as any).mockImplementation(() => ({
                encodeSignedTransactions: vi.fn((txs: unknown[]) =>
                    txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
                ),
                decodeTransactions: vi.fn(() => [
                    {
                        sender: { toString: () => 'MSIG_ADDR' },
                        fee: 1000n,
                    },
                ]),
            }))

            const mockSessionsMsig = [
                {
                    clientId: 'test-client-id',
                    session: {
                        clientId: 'test-client-id',
                        chainId: 4160,
                        accounts: ['MSIG_ADDR'],
                    },
                },
            ]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({ walletConnectConnections: mockSessionsMsig }),
            )

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [
                    [
                        {
                            txn: 'msig-txn',
                            signers: ['P1'],
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            // The tx must be included so the multisig propose transport
            // picks it up. `signerOverrides` must NOT be set — the
            // multisig branch short-circuits the per-participant override
            // (`signerAddress` stays at MSIG_ADDR; the transport selector
            // routes by sender).
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(1)
            expect(signRequest.signerOverrides).toBeUndefined()
        })

        it('reject({ kind: "softReject", error }) goes through ensureConnectorReady and removes the request, without setting connection-error banner', async () => {
            // Reset addSignRequest impl — the previous test set a throwing
            // mock that vi.clearAllMocks doesn't reset.
            mockAddSignRequest.mockReset()
            const mockRemoveSignRequest = vi.fn()
            ;(useSigningRequest as any).mockReturnValue({
                addSignRequest: mockAddSignRequest,
                removeSignRequest: mockRemoveSignRequest,
                clearLastFailedRequest: vi.fn(),
            })

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                sendTransaction: vi.fn(),
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            // Soft-reject must route through ensureConnectorReady so a
            // long-running multisig decline lands on a live socket. The
            // mock returns the same connector so the test can assert on
            // the eventual rejectRequest call.
            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            const payload = {
                params: [
                    [
                        {
                            message: 'Sign tx',
                            txn: 'encodedTxn',
                        },
                    ],
                ],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { reject } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]
            const handoffError = new Error(
                'Transaction handed off to multisig sign-request abc-123',
            )

            await reject({ kind: 'softReject', error: handoffError })

            expect(ensureConnectorReady).toHaveBeenCalledWith(
                'test-client-id',
                expect.any(Number),
            )
            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: handoffError,
            })
            expect(mockRemoveSignRequest).toHaveBeenCalledTimes(1)
            // Crucially: no connection-error banner — this is a
            // success-path handoff, not a failure.
            expect(mockSetConnectionError).not.toHaveBeenCalled()
        })

        it('default reject() (no args) keeps the legacy direct rejectRequest path', () => {
            // Regression: existing user-decline call sites pass no args.
            // Default kind must be `user`, NOT go through
            // ensureConnectorReady (a dead socket on user-initiated
            // decline is acceptable — nobody is blocked waiting for it).
            mockAddSignRequest.mockReset()
            ;(useSigningRequest as any).mockReturnValue({
                addSignRequest: mockAddSignRequest,
                removeSignRequest: vi.fn(),
                clearLastFailedRequest: vi.fn(),
            })

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            const payload = {
                params: [[{ message: 'Sign tx', txn: 'encodedTxn' }]],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                payload,
            )

            const { reject } =
                mockAddSignRequest.mock.calls[
                    mockAddSignRequest.mock.calls.length - 1
                ][0]
            ;(ensureConnectorReady as any).mockClear()

            act(() => {
                reject()
            })

            expect(ensureConnectorReady).not.toHaveBeenCalled()
            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: expect.objectContaining({ message: 'User rejected' }),
            })
        })
    })
})
