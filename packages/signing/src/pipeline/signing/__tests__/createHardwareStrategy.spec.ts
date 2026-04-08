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

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-blockchain')
    return {
        ...actual,
        Address: {
            fromString: (addr: string) => ({ address: addr }),
        },
    }
})

import { createHardwareStrategy } from '../createHardwareStrategy'
import type { EncodeTransactionFunction } from '../createHardwareStrategy'
import type { AnalyzedSignableGroup } from '../../types'
import type {
    WalletAccount,
    HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletTransportProvider,
    HardwareWalletTransport,
    HardwareWalletRegistry,
} from '@perawallet/wallet-core-hardware-wallet'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'

const SIGNER_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const DIFFERENT_SENDER =
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

const makeLedgerAccount = (
    address: string = SIGNER_ADDRESS,
    accountIndex: number = 0,
): HardwareWalletAccount =>
    ({
        type: 'hardware',
        address,
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            accountIndex,
        },
    }) as HardwareWalletAccount

const mockTransaction = (sender: string = SIGNER_ADDRESS) =>
    ({
        sender: { toString: () => sender },
    }) as never

const makeGroup = (
    transactions: unknown[],
    indicesToSign: number[],
    signerAddress: string = SIGNER_ADDRESS,
): AnalyzedSignableGroup => ({
    data: {
        type: 'transactions',
        transactions: transactions as never[],
        indicesToSign,
    },
    source: { type: 'local' },
    signerAddress,
    analysis: {
        totalFees: 0n,
        transactionSummaries: [],
        warnings: [],
        signableAddresses: [],
        riskLevel: 'low',
    },
})

const MOCK_SIGNATURE = new Uint8Array([1, 2, 3, 4])

const makeMockTransport = (): HardwareWalletTransport => ({
    getAddress: vi.fn().mockResolvedValue({
        address: SIGNER_ADDRESS,
        publicKey: new Uint8Array(32),
        accountIndex: 0,
    }),
    signTransaction: vi.fn().mockResolvedValue(MOCK_SIGNATURE),
    disconnect: vi.fn().mockResolvedValue(undefined),
})

const makeMockProvider = (
    transport: HardwareWalletTransport,
): HardwareWalletTransportProvider => ({
    manufacturer: 'ledger',
    scan: () => () => {},
    connect: vi.fn().mockResolvedValue(transport),
    isSupported: vi.fn().mockResolvedValue(true),
})

const makeRegistry = (
    provider: HardwareWalletTransportProvider,
): HardwareWalletRegistry => {
    const registry = createHardwareWalletRegistry()
    registry.register(provider)
    return registry
}

describe('createHardwareStrategy', () => {
    let mockTransport: HardwareWalletTransport
    let mockProvider: HardwareWalletTransportProvider
    let mockRegistry: HardwareWalletRegistry
    let encodeTransaction: EncodeTransactionFunction

    beforeEach(() => {
        mockTransport = makeMockTransport()
        mockProvider = makeMockProvider(mockTransport)
        mockRegistry = makeRegistry(mockProvider)
        encodeTransaction = vi.fn().mockReturnValue(new Uint8Array([0xaa]))
    })

    describe('canSign', () => {
        it('returns true for hardware wallet accounts', () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            expect(strategy.canSign(makeLedgerAccount())).toBe(true)
        })

        it('returns false for non-hardware accounts', () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const algo25Account = {
                type: 'algo25',
                address: SIGNER_ADDRESS,
                keyPairId: 'key-1',
            } as unknown as WalletAccount
            expect(strategy.canSign(algo25Account)).toBe(false)
        })
    })

    describe('sign', () => {
        it('signs transactions sequentially and returns result', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const txns = [mockTransaction(), mockTransaction()]
            const group = makeGroup(txns, [0, 1])
            const account = makeLedgerAccount()

            const result = await strategy.sign(group, account)

            expect(result.signedData.type).toBe('transactions')
            if (result.signedData.type === 'transactions') {
                expect(result.signedData.signed).toHaveLength(2)
                expect(result.signedData.signed[0].sig).toEqual(MOCK_SIGNATURE)
                expect(result.signedData.signed[1].sig).toEqual(MOCK_SIGNATURE)
            }
            expect(result.signers).toEqual([{ address: SIGNER_ADDRESS }])
        })

        it('signs transactions in sequential order (not concurrent)', async () => {
            const callOrder: number[] = []
            const transport = {
                ...makeMockTransport(),
                signTransaction: vi.fn().mockImplementation(async () => {
                    callOrder.push(callOrder.length)
                    return MOCK_SIGNATURE
                }),
            }
            const provider = makeMockProvider(transport)
            const registry = makeRegistry(provider)
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: registry,
                encodeTransaction,
            })

            const txns = [
                mockTransaction(),
                mockTransaction(),
                mockTransaction(),
            ]
            const group = makeGroup(txns, [0, 1, 2])
            await strategy.sign(group, makeLedgerAccount())

            expect(callOrder).toEqual([0, 1, 2])
            expect(transport.signTransaction).toHaveBeenCalledTimes(3)
        })

        it('skips transactions not in indicesToSign', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const txns = [
                mockTransaction(),
                mockTransaction(),
                mockTransaction(),
            ]
            const group = makeGroup(txns, [1]) // only sign index 1
            const account = makeLedgerAccount()

            const result = await strategy.sign(group, account)

            if (result.signedData.type === 'transactions') {
                expect(result.signedData.signed[0].sig).toBeUndefined()
                expect(result.signedData.signed[1].sig).toEqual(MOCK_SIGNATURE)
                expect(result.signedData.signed[2].sig).toBeUndefined()
            }
            expect(mockTransport.signTransaction).toHaveBeenCalledTimes(1)
        })

        it('sets authAddress when signer differs from sender', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const txns = [mockTransaction(DIFFERENT_SENDER)]
            const group = makeGroup(txns, [0], SIGNER_ADDRESS)
            const account = makeLedgerAccount()

            const result = await strategy.sign(group, account)

            if (result.signedData.type === 'transactions') {
                expect(result.signedData.signed[0].authAddress).toBeDefined()
            }
        })

        it('does not set authAddress when signer matches sender', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const txns = [mockTransaction(SIGNER_ADDRESS)]
            const group = makeGroup(txns, [0])
            const account = makeLedgerAccount()

            const result = await strategy.sign(group, account)

            if (result.signedData.type === 'transactions') {
                expect(result.signedData.signed[0].authAddress).toBeUndefined()
            }
        })

        it('calls disconnect in finally block even on error', async () => {
            const transport = {
                ...makeMockTransport(),
                signTransaction: vi
                    .fn()
                    .mockRejectedValue(new Error('BLE failure')),
            }
            const provider = makeMockProvider(transport)
            const registry = makeRegistry(provider)
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: registry,
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toThrow()
            expect(transport.disconnect).toHaveBeenCalled()
        })

        it('verifies Algorand app is open before signing using correct account index', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])
            await strategy.sign(group, makeLedgerAccount(SIGNER_ADDRESS, 3))

            expect(mockTransport.getAddress).toHaveBeenCalledWith(3, false)
        })

        it('fires progress callbacks in order', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const txns = [
                mockTransaction(),
                mockTransaction(),
                mockTransaction(),
            ]
            const group = makeGroup(txns, [0, 1, 2])
            const onProgress = vi.fn()

            await strategy.sign(group, makeLedgerAccount(), { onProgress })

            expect(onProgress).toHaveBeenCalledTimes(3)
            expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3)
            expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3)
            expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3)
        })

        it('throws CannotSignError for non-hardware wallet accounts', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const algo25Account = {
                type: 'algo25',
                address: SIGNER_ADDRESS,
                keyPairId: 'key-1',
            } as unknown as WalletAccount
            const group = makeGroup([mockTransaction()], [0])

            await expect(strategy.sign(group, algo25Account)).rejects.toThrow(
                'not a hardware wallet',
            )
        })

        it('throws HardwareWalletError when no transport provider', async () => {
            const strategy = createHardwareStrategy({
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toThrow('transport_unavailable')
        })

        it('calls onSigningStart before signing loop', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])
            const onSigningStart = vi.fn()

            await strategy.sign(group, makeLedgerAccount(), { onSigningStart })

            expect(onSigningStart).toHaveBeenCalledTimes(1)
        })

        it('calls onError callback when signing fails', async () => {
            const transport = {
                ...makeMockTransport(),
                signTransaction: vi
                    .fn()
                    .mockRejectedValue(new Error('BLE failure')),
            }
            const provider = makeMockProvider(transport)
            const registry = makeRegistry(provider)
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: registry,
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])
            const onError = vi.fn()

            await expect(
                strategy.sign(group, makeLedgerAccount(), { onError }),
            ).rejects.toThrow()

            expect(onError).toHaveBeenCalledTimes(1)
            expect(onError).toHaveBeenCalledWith(expect.any(Error))
        })

        it('calls onHardwarePrompt with connect and approve', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])
            const onHardwarePrompt = vi.fn()

            await strategy.sign(group, makeLedgerAccount(), {
                onHardwarePrompt,
            })

            expect(onHardwarePrompt).toHaveBeenCalledTimes(2)
            expect(onHardwarePrompt).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ type: 'connect' }),
            )
            expect(onHardwarePrompt).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ type: 'approve' }),
            )
        })

        it('preserves original error when disconnect also fails', async () => {
            const transport = {
                ...makeMockTransport(),
                signTransaction: vi
                    .fn()
                    .mockRejectedValue(new Error('signing failed')),
                disconnect: vi
                    .fn()
                    .mockRejectedValue(new Error('disconnect failed')),
            }
            const provider = makeMockProvider(transport)
            const registry = makeRegistry(provider)
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: registry,
                encodeTransaction,
            })
            const group = makeGroup([mockTransaction()], [0])

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toThrow('signing failed')
        })

        it('throws HardwareWalletError for non-transaction data types', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                encodeTransaction,
            })
            const group = {
                ...makeGroup([], []),
                data: { type: 'arbitrary-data' as const, data: [] },
            } as unknown as AnalyzedSignableGroup

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toThrow('unsupported_data_type')
        })
    })
})
