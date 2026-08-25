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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWalletConnectHandlers } from '../useWalletConnectHandlers'
import { useWalletConnectStore } from '../../store'
import { ensureConnectorReady } from '../../connection'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    useNetwork,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-shared'
import {
    canSignArbitraryData,
    isHardwareWalletAccount,
    useAllAccounts,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    WalletConnectConnectionTimeoutError,
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../../errors'

// Resolver spec is covered by packages/blockchain/.../resolve.spec.ts —
// these tests cover WC plumbing with a stub that avoids real msgpack.

vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

vi.mock('../../connection', () => ({
    ensureConnectorReady: vi.fn(),
}))

// Hoisted so the mock factories below can reference these. `txnSenderMap`
// and `signingAccountsState` are shared so tests can drive both the
// fake resolver and the accounts mock from one place.
const {
    MockArc0001Error,
    fakeArc0001Resolve,
    mockAddSignRequest,
    txnSenderMap,
    signingAccountsState,
} = vi.hoisted(() => {
    class MockArc0001Error extends Error {
        code: number
        data?: { index?: number; field?: string }
        constructor(
            code: number,
            message: string,
            data?: { index?: number; field?: string },
        ) {
            super(message)
            this.name = 'Arc0001Error'
            this.code = code
            this.data = data
        }
    }

    const txnSenderMap = new Map<string, string>()
    const signingAccountsState: {
        current: Array<{ address: string; name?: string; type?: string }>
    } = {
        current: [{ address: 'addr1', name: 'Account 1', type: 'standard' }],
    }
    const mockAddSignRequest = vi.fn()

    const fakeArc0001Resolve = (request: any, context: any) => {
        const transactions = request.transactions as Array<{
            txn: string
            signers?: string[]
            authAddr?: string
            msig?: unknown
            stxn?: string
        }>
        const decodedSender = (i: number, entry: { txn: string }) =>
            txnSenderMap.get(entry.txn) ?? `decoded-sender-${i}`

        const allDecoded = transactions.map((entry, i) => ({
            sender: {
                publicKey: new Uint8Array([1, 2, 3]),
                toString: () => decodedSender(i, entry),
            },
            fee: 1000n,
        }))

        const toSign: Array<{
            index: number
            walletTxn: (typeof transactions)[number]
            decoded: (typeof allDecoded)[number]
            sender: string
            signer: { kind: 'single'; address: string }
        }> = []
        const signerOverrides = new Map<number, string>()
        const signableAddresses: Set<string> = context.signableAddresses
        let requested = 0

        for (let i = 0; i < transactions.length; i++) {
            const entry = transactions[i]
            if (entry.msig) {
                throw new MockArc0001Error(4200, 'multisig not supported', {
                    index: i,
                    field: 'msig',
                })
            }
            if (entry.signers && entry.signers.length === 0) {
                if (entry.stxn !== undefined) {
                    throw new MockArc0001Error(
                        4200,
                        'stxn passthrough not supported',
                        { index: i, field: 'stxn' },
                    )
                }
                continue
            }
            if (entry.signers && entry.signers.length > 1) {
                throw new MockArc0001Error(4200, 'multisig not supported', {
                    index: i,
                    field: 'signers',
                })
            }
            requested++
            const sender = decodedSender(i, entry)
            let candidate: string
            if (entry.signers && entry.signers.length === 1) {
                candidate = entry.signers[0]
                if (
                    entry.authAddr !== undefined &&
                    candidate !== entry.authAddr
                ) {
                    throw new MockArc0001Error(
                        4300,
                        'signers[0] disagrees with authAddr',
                        { index: i, field: 'signers' },
                    )
                }
            } else {
                candidate = entry.authAddr ?? sender
            }

            if (
                context.authorizedAddresses !== undefined &&
                signableAddresses.has(candidate) &&
                !context.authorizedAddresses.has(candidate)
            ) {
                throw new MockArc0001Error(
                    4100,
                    `not authorized to sign with ${candidate}`,
                    { index: i },
                )
            }
            if (!signableAddresses.has(candidate)) continue

            const toSignIndex = toSign.length
            toSign.push({
                index: i,
                walletTxn: entry,
                decoded: allDecoded[i],
                sender,
                signer: { kind: 'single', address: candidate },
            })
            if (candidate !== sender) {
                signerOverrides.set(toSignIndex, candidate)
            }
        }

        // Mirrors the real resolver: a request that asked for at least one
        // signature but yielded nothing signable is an error, not an
        // all-null success.
        if (requested > 0 && toSign.length === 0) {
            throw new MockArc0001Error(
                4100,
                'the wallet cannot sign any of the requested transactions',
            )
        }

        return { allDecoded, toSign, signerOverrides }
    }

    return {
        MockArc0001Error,
        fakeArc0001Resolve,
        mockAddSignRequest,
        txnSenderMap,
        signingAccountsState,
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useTransactionEncoder: vi.fn(() => ({
        encodeSignedTransaction: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
        encodeSignedTransactions: vi.fn((txs: unknown[]) =>
            txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
        ),
    })),
    encodeAlgorandAddress: vi.fn(() => 'TEST_ADDRESS'),
    useNetwork: vi.fn(),
}))

// The ARC-60 wire schema + size cap live in the signing package (canonical
// tests in its own arc60-wire.spec.ts). The barrel can't be imported for real
// here (it loads react-native-mmkv), so reproduce just those two with `zod`
// via vi.hoisted — faithful enough for the handler's validate/route logic.
const { arc60WireSchema, assertArc60RequestWithinLimits } = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { z } = require('zod')
    return {
        arc60WireSchema: z.object({
            data: z.string().max(16 * 1024),
            signer: z.string().min(1).max(128),
            domain: z.string().min(1).max(256),
            authenticatorData: z.string().min(1).max(512),
            requestId: z.string().max(256).optional(),
            hdPath: z.string().max(256).optional(),
            metadata: z.object({
                scope: z.number().int(),
                encoding: z.string().min(1).max(32),
            }),
        }),
        assertArc60RequestWithinLimits: (rawParams: unknown) => {
            if ((JSON.stringify(rawParams) ?? '').length > 64 * 1024) {
                throw new Error('request exceeds the maximum allowed size')
            }
        },
    }
})

// Mocks the real `useArc0001Resolver` + `useEnqueueArc0001SignRequest` —
// the enqueue stub mirrors the real hook (which has its own tests) so
// these tests can keep asserting on the addSignRequest shape.
vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(),
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
    arc60WireSchema,
    assertArc60RequestWithinLimits,
    // Real semantic validation (SIWA parsing, scope, signer/date checks) is
    // covered by arc60.spec.ts in the signing package — these tests only
    // exercise WC-layer routing/session checks, so stub it as a no-op.
    validateArc60AuthRequest: vi.fn(),
    useArc0001Resolver:
        () =>
        (request: any, options: any = {}) =>
            fakeArc0001Resolve(request, {
                signableAddresses: new Set(
                    signingAccountsState.current.map(a => a.address),
                ),
                ...options,
            }),
    useEnqueueArc0001SignRequest: () => (resolved: any, transport: any) => {
        const totalLength = resolved.allDecoded.length
        if (resolved.toSign.length === 0) {
            transport.respondWithResult(new Array(totalLength).fill(null))
            return
        }
        const indicesToSign = resolved.toSign.map((t: any) => t.index)
        const signRequest = {
            id: 'MOCK_UUID',
            type: 'transactions',
            transport: 'callback',
            sourceType: transport.sourceType,
            transportId: transport.transportId,
            sourceMetadata: transport.sourceMetadata,
            txs: resolved.toSign.map((t: any) => t.decoded),
            groupContext: resolved.allDecoded,
            rawTransactionsBase64: resolved.toSign.map(
                (t: any) => t.walletTxn.txn,
            ),
            signerOverrides:
                resolved.signerOverrides.size > 0
                    ? resolved.signerOverrides
                    : undefined,
            approve: async (signed: Array<unknown>) => {
                const result: Array<string | null> = new Array(
                    totalLength,
                ).fill(null)
                signed.forEach((tx, i) => {
                    if (tx) result[indicesToSign[i]] = 'AQIDBA=='
                })
                await transport.respondWithResult(result)
            },
            reject: async (
                reason:
                    | { kind: 'user' }
                    | { kind: 'softReject'; error: Error } = {
                    kind: 'user',
                },
            ) => {
                if (
                    reason.kind === 'softReject' &&
                    transport.respondWithSoftReject
                ) {
                    await transport.respondWithSoftReject(reason.error)
                    return
                }
                transport.respondWithReject()
            },
            error: async (err: Error) => transport.respondWithError(err),
        }
        mockAddSignRequest(signRequest)
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => {
    // Stands in for the real `hasSigningKeys` (a keyPairId check) by account
    // type, so fixtures don't have to carry key ids: hardware, watch and
    // multisig accounts hold no local key. Tests flip this on by setting
    // account.type.
    const canSignArbitraryData = vi.fn(
        (account: any) =>
            account?.type !== 'hardware' &&
            account?.type !== 'watch' &&
            account?.type !== 'multisig',
    )
    const isHardwareWalletAccount = vi.fn(
        (account: any) => account?.type === 'hardware',
    )
    const isMultisigAccount = vi.fn((a: any) => a?.type === 'multisig')
    return {
        useAllAccounts: vi.fn(() => signingAccountsState.current),
        useSigningAccounts: vi.fn(() => signingAccountsState.current),
        canSignWith: vi.fn(() => true),
        canSignArbitraryData,
        // Mirror the real composition so tests that toggle the predicates
        // exercise canSignArc60 without setting it directly — including the
        // rekey hop, which decides capability for a rekeyed signer.
        canSignArc60: vi.fn((account: any, accounts: any[] = []) => {
            const signer = account?.rekeyAddress
                ? accounts.find((a: any) => a.address === account.rekeyAddress)
                : account
            return (
                !!signer &&
                !isMultisigAccount(signer) &&
                (canSignArbitraryData(signer) ||
                    isHardwareWalletAccount(signer))
            )
        }),
        getAccountDisplayName: vi.fn((a: any) => a.name || a.address),
        isHardwareWalletAccount,
        isMultisigAccount,
    }
})

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-shared')
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(actual as any),
        logger: {
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        decodeFromBase64: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
        encodeToBase64: vi.fn(() => 'AQIDBA=='),
        generateOrderedUniqueId: vi.fn(() => 'MOCK_UUID'),
    }
})

describe('useWalletConnectHandlers', () => {
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
        txnSenderMap.clear()
        // Default: every stub txn in the tests has sender 'addr1'.
        txnSenderMap.set('encodedTxn', 'addr1')
        txnSenderMap.set('encodedTxn0', 'addr1')
        txnSenderMap.set('encodedTxn1', 'addr1')
        txnSenderMap.set('signable-txn', 'addr1')
        txnSenderMap.set('signable-txn-2', 'addr1')
        txnSenderMap.set('skip-txn', 'addr1')
        txnSenderMap.set('skip-txn-1', 'addr1')
        txnSenderMap.set('skip-txn-2', 'addr1')
        txnSenderMap.set('txn', 'addr1')
        txnSenderMap.set('txn-with-signer', 'addr1')
        txnSenderMap.set('txn-no-signers', 'addr1')
        signingAccountsState.current = [
            { address: 'addr1', name: 'Account 1', type: 'standard' },
        ]
        ;(isHardwareWalletAccount as any).mockReturnValue(false)
        ;(useTransactionEncoder as any).mockImplementation(() => ({
            encodeSignedTransaction: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
            encodeSignedTransactions: vi.fn((txs: unknown[]) =>
                txs.length > 0 ? [new Uint8Array([1, 2, 3, 4])] : [],
            ),
        }))
        ;(useSigningRequest as any).mockReturnValue({
            addSignRequest: mockAddSignRequest,
            removeSignRequest: vi.fn(),
        })
        ;(useNetwork as any).mockReturnValue({
            network: Networks.mainnet,
        })
        // Validation reads connections via getState() at request time (the
        // hook holds no render subscription on the store anymore).
        ;(useWalletConnectStore as any).getState = () => ({
            walletConnectConnections: mockSessions,
            setConnectionError: mockSetConnectionError,
        })
        // Default: ensureConnectorReady resolves to a connector with
        // approve/reject stubs. Tests that assert on a specific connector
        // override this with `.mockResolvedValue(connector)`.
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

            const { approve } = mockAddSignRequest.mock.calls[0][0]
            const signature = new Uint8Array([1, 2, 3])

            ;(ensureConnectorReady as any).mockResolvedValue(connector)
            await act(async () => {
                await approve([{ signature }])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA=='],
            })
        })

        it('should handle rejection callback', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)
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

            await act(async () => {
                await reject()
            })

            await vi.waitFor(() => {
                expect(connector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: expect.objectContaining({
                        message: 'User rejected',
                    }),
                })
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
            ;(ensureConnectorReady as any).mockResolvedValue(connector)
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

            await vi.waitFor(() => {
                expect(connector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: incomingError,
                })
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
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: [],
                setConnectionError: mockSetConnectionError,
            })
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
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: [
                    {
                        clientId: 'test-client-id',
                        session: {
                            clientId: 'test-client-id',
                            chainId: 999999,
                        },
                    },
                ],
                setConnectionError: mockSetConnectionError,
            })
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

        it('throws WalletConnectSignRequestError if data is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
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
        // Cases here override `canSignArbitraryData` with a flat
        // `mockReturnValue`, and nothing in the config resets mocks between
        // tests — restore the account-type rule so a later case can still
        // model a keyless account.
        beforeEach(() => {
            ;(canSignArbitraryData as any).mockImplementation(
                (account: any) =>
                    account?.type !== 'hardware' &&
                    account?.type !== 'watch' &&
                    account?.type !== 'multisig',
            )
        })

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

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload({ signer: '' }),
                ),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('throws WalletConnectInvalidSessionError when ARC-60 signer is not in the session', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload({ signer: 'unknown-addr' }),
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('accepts a signer that is the rekeyAddress of a session account', () => {
            // use-wallet v5 resolves the ARC-60 signer to the connected
            // account's auth address, which is never in session.accounts.
            ;(canSignArbitraryData as any).mockReturnValue(true)
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Rekeyed',
                    type: 'standard',
                    rekeyAddress: 'auth-addr',
                },
                { address: 'auth-addr', name: 'Auth', type: 'standard' },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            result.current.handleSignData(
                connector,
                Networks.mainnet,
                null,
                arc60Payload({ signer: 'auth-addr' }),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arc60',
                    stdSigData: expect.objectContaining({
                        signer: 'auth-addr',
                    }),
                }),
            )
        })

        it('accepts a keyless rekeyed signer whose auth account holds keys', () => {
            // The dApp names the connected account itself (pera-demo-dapp
            // scenario #84), not its auth address. Capability follows the
            // rekey hop, so the auth account's key signs (PERA-4977).
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Rekeyed',
                    type: 'watch',
                    rekeyAddress: 'auth-addr',
                },
                { address: 'auth-addr', name: 'Auth', type: 'standard' },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            result.current.handleSignData(
                connector,
                Networks.mainnet,
                null,
                arc60Payload({ signer: 'addr1' }),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arc60',
                    stdSigData: expect.objectContaining({ signer: 'addr1' }),
                }),
            )
        })

        it('rejects a keyless rekeyed signer whose auth account is also keyless', () => {
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Rekeyed',
                    type: 'watch',
                    rekeyAddress: 'auth-addr',
                },
                { address: 'auth-addr', name: 'Auth', type: 'watch' },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload({ signer: 'addr1' }),
                ),
            ).toThrow('Signer cannot sign ARC-60 payloads')
        })

        it('rejects a rekeyed signer whose auth account is a multisig', () => {
            // ARC-60 responses carry a single signature, so a threshold
            // account can never be represented.
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Rekeyed',
                    type: 'watch',
                    rekeyAddress: 'auth-addr',
                },
                { address: 'auth-addr', name: 'Auth', type: 'multisig' },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload({ signer: 'addr1' }),
                ),
            ).toThrow('Signer cannot sign ARC-60 payloads')
        })

        it('rejects a signer that is only the rekeyAddress of a non-session account', () => {
            ;(useAllAccounts as any).mockReturnValue([
                { address: 'addr1', name: 'Connected', type: 'standard' },
                {
                    address: 'other-addr',
                    name: 'Not connected',
                    type: 'standard',
                    rekeyAddress: 'auth-addr',
                },
                { address: 'auth-addr', name: 'Auth', type: 'standard' },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload({ signer: 'auth-addr' }),
                ),
            ).toThrow('Invalid signer')
        })

        it('rejects a rekey-resolved signer whose account is not in the wallet', () => {
            // Session check passes via the rekey chain, but the auth account
            // itself was never imported — capability check must still refuse.
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Rekeyed',
                    type: 'standard',
                    rekeyAddress: 'auth-addr',
                },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    arc60Payload({ signer: 'auth-addr' }),
                ),
            ).toThrow('Signer cannot sign ARC-60 payloads')
        })

        it('legacy arbitrary-data path does not follow rekeys', () => {
            // Off-chain legacy signing has no auth-addr lookup — the dApp
            // verifies against the requested account's own pubkey — so the
            // rekey acceptance is deliberately ARC-60-only.
            ;(useAllAccounts as any).mockReturnValue([
                {
                    address: 'addr1',
                    name: 'Rekeyed',
                    type: 'standard',
                    rekeyAddress: 'auth-addr',
                },
                { address: 'auth-addr', name: 'Auth', type: 'standard' },
            ])

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' } as any

            expect(() =>
                result.current.handleSignData(
                    connector,
                    Networks.mainnet,
                    null,
                    {
                        id: 7,
                        params: [
                            {
                                message: 'Sign me',
                                data: 'somedata',
                                chainId: 4160,
                                signer: 'auth-addr',
                            },
                        ],
                    },
                ),
            ).toThrow('Invalid signer')
        })

        it('throws WalletConnectInvalidSessionError for Ledger accounts', () => {
            signingAccountsState.current = [
                {
                    address: 'ledger-addr',
                    name: 'Ledger',
                    type: 'hardware',
                },
            ]
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: [
                    {
                        clientId: 'test-client-id',
                        session: {
                            clientId: 'test-client-id',
                            chainId: 4160,
                            accounts: ['ledger-addr'],
                        },
                    },
                ],
                setConnectionError: mockSetConnectionError,
            })
            ;(isHardwareWalletAccount as any).mockReturnValue(true)

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(
                    connector as any,
                    Networks.mainnet,
                    null,
                    {
                        params: [
                            {
                                message: 'x',
                                data: 'y',
                                chainId: 4160,
                                signer: 'ledger-addr',
                            },
                        ],
                    },
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })
    })

    describe('handleSignTransaction', () => {
        const txnPayload = (
            entries: Array<{
                txn: string
                signers?: string[]
                authAddr?: string
                message?: string
            }> = [{ txn: 'encodedTxn', message: 'Sign tx' }],
        ): WalletConnectTransactionPayload =>
            ({
                params: [entries],
                method: 'algo_signTxn' as const,
                jsonrpc: '2.0',
                id: 1,
            }) as unknown as WalletConnectTransactionPayload

        it('queues a sign request and approves with the encoded signature', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'MOCK_UUID',
                    type: 'transactions',
                    transport: 'callback',
                    sourceType: 'walletconnect',
                    transportId: 'test-client-id',
                    txs: expect.arrayContaining([
                        expect.objectContaining({ fee: 1000n }),
                    ]),
                    groupContext: expect.any(Array),
                    rawTransactionsBase64: expect.any(Array),
                }),
            )

            const { approve } = mockAddSignRequest.mock.calls[0][0]
            await act(async () => {
                await approve([
                    {
                        txn: { sender: { publicKey: new Uint8Array([10]) } },
                        sig: new Uint8Array([1]),
                    },
                ])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA=='],
            })
        })

        it('wires reject to guarded delivery on the revived connector', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]
            await act(async () => {
                await reject()
            })

            await vi.waitFor(() => {
                expect(connector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: expect.objectContaining({
                        message: 'User rejected',
                    }),
                })
            })
        })

        it('wires error to guarded delivery and surfaces a connection error', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            const { error } = mockAddSignRequest.mock.calls[0][0]
            const incomingError = new Error('Rejected')
            await error(incomingError)

            await vi.waitFor(() => {
                expect(connector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: incomingError,
                })
            })
            expect(mockSetConnectionError).toHaveBeenCalledWith(
                expect.any(WalletConnectSignRequestError),
            )
        })

        it('throws WalletConnectInvalidSessionError when no session matches', () => {
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: [],
                setConnectionError: mockSetConnectionError,
            })
            const { result } = renderHook(() => useWalletConnectHandlers())

            expect(() =>
                result.current.handleSignTransaction(
                    { clientId: 'test-client-id' } as any,
                    Networks.mainnet,
                    null,
                    {} as WalletConnectTransactionPayload,
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('validates against live store state, not the handler render snapshot', () => {
            // First algo_signTxn right after pairing: the handlers were bound
            // from a render that happened before approval, so the store is
            // empty at render time and only gains the session afterwards.
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: [],
                setConnectionError: mockSetConnectionError,
            })
            const { result } = renderHook(() => useWalletConnectHandlers())
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: mockSessions,
                setConnectionError: mockSetConnectionError,
            })
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    Networks.mainnet,
                    null,
                    txnPayload(),
                ),
            ).not.toThrow()
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        })

        it('excludes transactions with signers: [] from the sign request', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([
                    { txn: 'signable-txn' },
                    { txn: 'skip-txn', signers: [] },
                    { txn: 'signable-txn-2' },
                ]),
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(2)
        })

        it('reconstructs a full-length result with nulls for skipped slots', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([
                    { txn: 'signable-txn' },
                    { txn: 'skip-txn', signers: [] },
                    { txn: 'skip-txn-2', signers: [] },
                ]),
            )

            const { approve } = mockAddSignRequest.mock.calls[0][0]
            await act(async () => {
                await approve([
                    { txn: { sender: {} }, sig: new Uint8Array([1]) },
                ])
            })

            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: ['AQIDBA==', null, null],
            })
        })

        it('approves with all-nulls when every entry is signers: []', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([
                    { txn: 'skip-txn-1', signers: [] },
                    { txn: 'skip-txn-2', signers: [] },
                ]),
            )
            // deliverApprove resolves on the next microtask
            await Promise.resolve()
            await Promise.resolve()

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(connector.approveRequest).toHaveBeenCalledWith({
                id: 1,
                result: [null, null],
            })
        })

        it('includes transactions whose signers array matches a user account', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([
                    { txn: 'txn-with-signer', signers: ['addr1'] },
                    { txn: 'txn-no-signers' },
                ]),
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(2)
        })

        it('excludes transactions with non-user sender when signers is absent (Folks Finance)', () => {
            txnSenderMap.set('user-txn-1', 'addr1')
            txnSenderMap.set('contract-txn', 'CONTRACT_ADDR')
            txnSenderMap.set('user-txn-2', 'addr1')

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([
                    { txn: 'user-txn-1' },
                    { txn: 'contract-txn' },
                    { txn: 'user-txn-2' },
                ]),
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(2)
        })

        it('sets signerOverrides when an explicit signer differs from sender (rekey-style)', () => {
            txnSenderMap.set('contract-txn', 'CONTRACT_ADDR')

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([{ txn: 'contract-txn', signers: ['addr1'] }]),
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.txs).toHaveLength(1)
            expect(signRequest.signerOverrides).toEqual(new Map([[0, 'addr1']]))
        })

        it('rejects with 4100 when signers only references unknown addresses (no all-null success)', async () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    Networks.mainnet,
                    null,
                    txnPayload([{ txn: 'txn', signers: ['UNKNOWN_ADDR'] }]),
                ),
            ).toThrow(
                expect.objectContaining({
                    name: 'Arc0001Error',
                    code: 4100,
                }),
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(connector.approveRequest).not.toHaveBeenCalled()
        })

        it('forwards the full pre-filter payload as groupContext for group-integrity validation', () => {
            // Regression: `txs` only carries the wallet's signable subset,
            // so the signing pipeline needs the full payload via
            // `groupContext` to recompute the group hash.
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload([
                    { txn: 'encodedTxn0', message: 'user' },
                    { txn: 'encodedTxn1', message: 'dapp', signers: [] },
                ]),
            )

            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
            const sentRequest = mockAddSignRequest.mock.calls[0][0]
            expect(sentRequest.txs).toHaveLength(1)
            expect(sentRequest.groupContext).toHaveLength(2)
        })

        it('rejects sign requests for a local account that is not in the session (PERA-4267)', () => {
            // Wallet has addr1 (in session) AND addr2 (NOT in session). A
            // malicious dApp asks the wallet to sign a tx whose sender is
            // addr2. The session approves addr1 only, so the request must
            // be refused before reaching the signing sheet.
            signingAccountsState.current = [
                { address: 'addr1', name: 'A', type: 'standard' },
                { address: 'addr2', name: 'B', type: 'standard' },
            ]
            txnSenderMap.set('encodedTxn', 'addr2')

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    Networks.mainnet,
                    null,
                    txnPayload(),
                ),
            ).toThrow(
                expect.objectContaining({
                    name: 'Arc0001Error',
                    code: 4100,
                }),
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects sign requests where explicit signers field targets a non-session local account (PERA-4267)', () => {
            // Variant: sender is a third-party (contract), but the dApp
            // sets `signers: [addr2]` to coerce the wallet into signing
            // with addr2 (not in session). Must reject.
            signingAccountsState.current = [
                { address: 'addr1', name: 'A', type: 'standard' },
                { address: 'addr2', name: 'B', type: 'standard' },
            ]
            txnSenderMap.set('encodedTxn', 'CONTRACT_ADDR')

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    Networks.mainnet,
                    null,
                    txnPayload([{ txn: 'encodedTxn', signers: ['addr2'] }]),
                ),
            ).toThrow(
                expect.objectContaining({
                    name: 'Arc0001Error',
                    code: 4100,
                }),
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('propagates errors from addSignRequest (e.g. queue full)', () => {
            mockAddSignRequest.mockImplementation(() => {
                throw new Error('Transaction limit exceeded')
            })

            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    Networks.mainnet,
                    null,
                    txnPayload(),
                ),
            ).toThrow('Transaction limit exceeded')
        })

        it('reject({ kind: "softReject" }) goes through ensureConnectorReady and does not raise the connection-error banner', async () => {
            mockAddSignRequest.mockReset()
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(connector)

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]
            const softRejectError = new Error('Participant declined')
            await act(async () => {
                await reject({ kind: 'softReject', error: softRejectError })
            })

            expect(ensureConnectorReady).toHaveBeenCalledWith(
                'test-client-id',
                expect.any(Number),
            )
            expect(connector.rejectRequest).toHaveBeenCalledWith({
                id: 1,
                error: softRejectError,
            })
            // softReject is a clean reject — no connection-error banner.
            expect(mockSetConnectionError).not.toHaveBeenCalled()
        })

        it('swallows WalletConnectConnectionTimeoutError in respondWithError without surfacing a banner', async () => {
            mockAddSignRequest.mockReset()
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }

            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            const { error } = mockAddSignRequest.mock.calls[0][0]
            await error(new WalletConnectConnectionTimeoutError('timeout'))

            // Connection timeouts are retried by the signing machine; the
            // WC layer must not double-deliver via rejectRequest or raise
            // the inline connection-error banner.
            expect(connector.rejectRequest).not.toHaveBeenCalled()
            expect(mockSetConnectionError).not.toHaveBeenCalled()
        })
    })

    // A paired dApp can overwrite its live connector.session.peerMeta after
    // the user approved the session (the library rewrites it on any second
    // handshake frame). Identity on the sign sheet must come from the store
    // snapshot captured at approval time, never the live connector, or a drain
    // renders under a spoofed brand (PERA-4713).
    describe('sourceMetadata identity stamping (PERA-4713)', () => {
        const approvedPeerMeta = {
            name: 'NFT Airdrop',
            url: 'https://airdrop.example',
            description: '',
            icons: [],
        }
        const spoofedLivePeerMeta = {
            name: 'Tinyman',
            url: 'https://tinyman.org',
            description: '',
            icons: ['https://tinyman.org/logo.png'],
        }

        beforeEach(() => {
            // Earlier hardware-signer tests override these predicates with bare
            // mockReturnValue calls, which survive clearAllMocks — restore the
            // factory implementations so a standard signer passes the gate.
            ;(canSignArbitraryData as any).mockImplementation(
                (account: any) => account?.type !== 'hardware',
            )
            ;(useAllAccounts as any).mockImplementation(
                () => signingAccountsState.current,
            )
            ;(useWalletConnectStore as any).getState = () => ({
                walletConnectConnections: [
                    {
                        clientId: 'test-client-id',
                        session: {
                            clientId: 'test-client-id',
                            chainId: 4160,
                            accounts: ['addr1'],
                            peerMeta: approvedPeerMeta,
                        },
                    },
                ],
                setConnectionError: mockSetConnectionError,
            })
        })

        const spoofedConnector = () => ({
            clientId: 'test-client-id',
            session: { peerMeta: spoofedLivePeerMeta },
            approveRequest: vi.fn(),
            rejectRequest: vi.fn(),
        })

        it('stamps algo_signTxn from the approved snapshot, not the live connector', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())

            result.current.handleSignTransaction(
                spoofedConnector() as any,
                Networks.mainnet,
                null,
                {
                    params: [[{ txn: 'encodedTxn' }]],
                    method: 'algo_signTxn',
                    jsonrpc: '2.0',
                    id: 1,
                } as any,
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.sourceMetadata).toEqual(approvedPeerMeta)
        })

        it('stamps arbitrary-data signing from the approved snapshot', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())

            result.current.handleSignData(
                spoofedConnector() as any,
                Networks.mainnet,
                null,
                {
                    params: [
                        {
                            message: 'Sign me',
                            data: 'somedata',
                            chainId: 4160,
                            signer: 'addr1',
                        },
                    ],
                    id: 1,
                },
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.sourceMetadata).toEqual(approvedPeerMeta)
        })

        it('stamps ARC-60 signing from the approved snapshot', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())

            result.current.handleSignData(
                spoofedConnector() as any,
                Networks.mainnet,
                null,
                {
                    id: 42,
                    params: {
                        data: 'aGVsbG8=',
                        signer: 'addr1',
                        domain: 'example.com',
                        authenticatorData: 'YXV0aA==',
                        metadata: { scope: 1, encoding: 'utf-8' },
                    },
                },
            )

            const signRequest = mockAddSignRequest.mock.calls[0][0]
            expect(signRequest.sourceMetadata).toEqual(approvedPeerMeta)
        })
    })

    // User rejections and error responses must not call the (possibly
    // dead-socketed) connector directly — WC v1 silently queues into a dead
    // socket after backgrounding, leaving the dApp hanging. Every response
    // goes through ensureConnectorReady's revived connector.
    describe('guarded reject delivery', () => {
        beforeEach(() => {
            // Earlier hardware-signer tests override these with bare
            // mockReturnValue calls, which survive clearAllMocks —
            // restore the factory implementations.
            ;(canSignArbitraryData as any).mockImplementation(
                (account: any) => account?.type !== 'hardware',
            )
            ;(useAllAccounts as any).mockImplementation(
                () => signingAccountsState.current,
            )
        })

        const dataPayload = () => ({
            params: [
                {
                    message: 'Sign me',
                    data: 'somedata',
                    chainId: 4160,
                    signer: 'addr1',
                },
            ],
            id: 1,
        })
        const arc60Payload = () => ({
            id: 42,
            params: {
                data: 'aGVsbG8=',
                signer: 'addr1',
                domain: 'example.com',
                authenticatorData: 'YXV0aA==',
                metadata: { scope: 1, encoding: 'utf-8' },
            },
        })
        const txnPayload = () =>
            ({
                params: [[{ txn: 'encodedTxn' }]],
                method: 'algo_signTxn',
                jsonrpc: '2.0',
                id: 1,
            }) as unknown as WalletConnectTransactionPayload

        it('delivers an arbitrary-data user reject through the revived connector', async () => {
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const readyConnector = {
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(readyConnector)

            const { result } = renderHook(() => useWalletConnectHandlers())
            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                dataPayload(),
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]
            await act(async () => {
                await reject()
            })

            await vi.waitFor(() => {
                expect(readyConnector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: expect.objectContaining({
                        message: 'User rejected',
                    }),
                })
            })
            expect(ensureConnectorReady).toHaveBeenCalledWith(
                'test-client-id',
                expect.any(Number),
            )
            expect(connector.rejectRequest).not.toHaveBeenCalled()
        })

        it('delivers an ARC-60 user reject through the revived connector', async () => {
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const readyConnector = {
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(readyConnector)

            const { result } = renderHook(() => useWalletConnectHandlers())
            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                arc60Payload(),
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]
            await act(async () => {
                await reject()
            })

            await vi.waitFor(() => {
                expect(readyConnector.rejectRequest).toHaveBeenCalledWith({
                    id: 42,
                    error: expect.objectContaining({
                        message: 'User rejected',
                    }),
                })
            })
            expect(connector.rejectRequest).not.toHaveBeenCalled()
        })

        it('delivers a transaction user reject through the revived connector', async () => {
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const readyConnector = {
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(readyConnector)

            const { result } = renderHook(() => useWalletConnectHandlers())
            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]
            await act(async () => {
                await reject()
            })

            await vi.waitFor(() => {
                expect(readyConnector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: expect.objectContaining({
                        message: 'User rejected',
                    }),
                })
            })
            expect(connector.rejectRequest).not.toHaveBeenCalled()
        })

        it('delivers an arbitrary-data error response through the revived connector and still raises the banner', async () => {
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const readyConnector = {
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(readyConnector)

            const { result } = renderHook(() => useWalletConnectHandlers())
            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                dataPayload(),
            )

            const { error } = mockAddSignRequest.mock.calls[0][0]
            const incomingError = new Error('boom')
            await act(async () => {
                await error(incomingError)
            })

            await vi.waitFor(() => {
                expect(readyConnector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: incomingError,
                })
            })
            expect(mockSetConnectionError).toHaveBeenCalledWith(
                expect.any(WalletConnectSignRequestError),
            )
            expect(connector.rejectRequest).not.toHaveBeenCalled()
        })

        it('delivers a transaction error response through the revived connector and still raises the banner', async () => {
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            const readyConnector = {
                approveRequest: vi.fn(),
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockResolvedValue(readyConnector)

            const { result } = renderHook(() => useWalletConnectHandlers())
            result.current.handleSignTransaction(
                connector as any,
                Networks.mainnet,
                null,
                txnPayload(),
            )

            const { error } = mockAddSignRequest.mock.calls[0][0]
            const incomingError = new Error('boom')
            await act(async () => {
                await error(incomingError)
            })

            await vi.waitFor(() => {
                expect(readyConnector.rejectRequest).toHaveBeenCalledWith({
                    id: 1,
                    error: incomingError,
                })
            })
            expect(mockSetConnectionError).toHaveBeenCalledWith(
                expect.any(WalletConnectSignRequestError),
            )
            expect(connector.rejectRequest).not.toHaveBeenCalled()
        })

        it('swallows a failed revival on user reject without throwing', async () => {
            const connector = {
                clientId: 'test-client-id',
                rejectRequest: vi.fn(),
            }
            ;(ensureConnectorReady as any).mockRejectedValue(
                new WalletConnectConnectionTimeoutError('socket stayed dead'),
            )

            const { result } = renderHook(() => useWalletConnectHandlers())
            result.current.handleSignData(
                connector as any,
                Networks.mainnet,
                null,
                dataPayload(),
            )

            const { reject } = mockAddSignRequest.mock.calls[0][0]
            await expect(reject()).resolves.toBeUndefined()

            await act(async () => {
                await Promise.resolve()
            })
            expect(connector.rejectRequest).not.toHaveBeenCalled()
        })
    })
})
