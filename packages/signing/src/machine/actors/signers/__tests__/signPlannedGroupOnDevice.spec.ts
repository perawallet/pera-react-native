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

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Shrunk so the timeout cases run on real timers in well under a second.
vi.mock('@perawallet/wallet-core-ledger', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-ledger')
    return {
        ...actual,
        LEDGER_CONNECTION_TIMEOUT_MS: 50,
        LEDGER_CONFIRMATION_TIMEOUT_MS: 50,
    }
})

import type {
    HardwareRef,
    HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    SigningRequest,
    TransactionPlanner,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    createHardwareWalletRegistry,
    type HardwareWalletRegistry,
    type HardwareWalletTransport,
    type HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    LedgerDeviceNotFoundError,
    LedgerDisconnectedError,
    LedgerTimeoutError,
    LEDGER_CONNECTION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import { encodeToBase64, type Optional } from '@perawallet/wallet-core-shared'
import {
    SECOND_CHAIN_SCOPE,
    fakeTransactionPlanner,
    makeUnsignedTransaction,
    planFromPayload,
    registerFakeTransactionPlanner,
} from '../../../../__tests__/transactions'
import { TEST_LEDGER_DEVICE } from '../../../../__tests__/accounts'
import {
    CannotSignError,
    InvalidSignableDataError,
    SigningError,
} from '../../../../pipeline/errors'
import type {
    AnalyzedSignableGroup,
    SigningCallbacks,
    SourceMetadata,
} from '../../../../pipeline/types'
import { signPlannedGroupOnDevice } from '../signPlannedGroupOnDevice'

const SIGNER = '0xSIGNER'
const OTHER = '0xOTHER'
const DEVICE_SIGNATURE = new Uint8Array([1, 2, 3, 4])

const deviceAccount = (
    accountIndex = 0,
    device: Partial<HardwareRef> = {},
): HardwareWalletAccount => ({
    id: 'ledger',
    custody: {
        kind: 'hardware',
        device: { ...TEST_LEDGER_DEVICE, ...device },
        accountIndex,
    },
    chains: { [SECOND_CHAIN_SCOPE.chainId]: { address: SIGNER } },
})

const groupOf = (
    transactions: UnsignedTransaction[],
    overrides: Partial<AnalyzedSignableGroup> = {},
): AnalyzedSignableGroup => ({
    data: { type: 'transactions', transactions },
    source: { type: 'local' },
    signerAddress: SIGNER,
    originalIndices: transactions.map((_, index) => index),
    analysis: {
        totalFees: 0n,
        warnings: [],
        signableAddresses: [SIGNER],
        riskLevel: 'low',
    },
    ...overrides,
})

const transfers = (count: number): UnsignedTransaction[] =>
    Array.from({ length: count }, () => makeUnsignedTransaction(SIGNER))

const devicePayloadOf = (from: string): Uint8Array =>
    new Uint8Array(new TextEncoder().encode(`device:${from}`))

const makeTransport = (
    overrides: Partial<HardwareWalletTransport> = {},
): HardwareWalletTransport => ({
    getAddress: vi.fn().mockResolvedValue({
        address: SIGNER,
        publicKey: new Uint8Array(32),
        accountIndex: 0,
    }),
    signTransaction: vi.fn().mockResolvedValue(DEVICE_SIGNATURE),
    signMessage: vi.fn(),
    getAppVersion: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
})

const makeProvider = (
    transport: HardwareWalletTransport,
    transportType: HardwareRef['transportType'] = 'ble',
): HardwareWalletTransportProvider => ({
    manufacturer: 'ledger',
    transportType,
    scan: () => () => {},
    connect: vi.fn().mockResolvedValue(transport),
    isSupported: vi.fn().mockResolvedValue(true),
})

const registryOf = (
    provider: HardwareWalletTransportProvider,
): HardwareWalletRegistry => {
    const registry = createHardwareWalletRegistry()
    registry.register(provider)
    return registry
}

describe('signPlannedGroupOnDevice', () => {
    let transport: HardwareWalletTransport
    let provider: HardwareWalletTransportProvider
    let planner: TransactionPlanner

    beforeEach(() => {
        transport = makeTransport()
        provider = makeProvider(transport)
        planner = registerFakeTransactionPlanner(
            fakeTransactionPlanner(planFromPayload),
        )
        vi.spyOn(planner, 'assemble')
    })

    const sign = (
        group: AnalyzedSignableGroup,
        callbacks?: SigningCallbacks,
        account: HardwareWalletAccount = deviceAccount(),
        registry: Optional<HardwareWalletRegistry> = registryOf(provider),
    ) =>
        signPlannedGroupOnDevice({
            group,
            account,
            scope: SECOND_CHAIN_SCOPE,
            registry,
            callbacks,
        })

    describe('signing', () => {
        it("signs each request's device bytes, not its key-store payload, and assembles through the planner", async () => {
            const [transaction] = transfers(1)

            const result = await sign(groupOf([transaction]))

            expect(transport.signTransaction).toHaveBeenCalledWith(
                0,
                devicePayloadOf(SIGNER),
            )
            expect(planner.assemble).toHaveBeenCalledWith(transaction, [
                {
                    requestIndex: 0,
                    signer: SIGNER,
                    scheme: 'ed25519',
                    bytes: DEVICE_SIGNATURE,
                },
            ])
            expect(result.signedData).toEqual({
                type: 'signed-transactions',
                signed: [
                    {
                        scope: SECOND_CHAIN_SCOPE,
                        id: `signed-by-${SIGNER}`,
                        bytes: DEVICE_SIGNATURE,
                    },
                ],
                historyEntries: [
                    {
                        summary: transaction.summary,
                        chainData: transaction.chainData,
                    },
                ],
            })
        })

        it("connects to the account's device for the scope's chain and verifies the account index", async () => {
            await sign(groupOf(transfers(1)), undefined, deviceAccount(3))

            expect(provider.connect).toHaveBeenCalledWith(
                TEST_LEDGER_DEVICE.deviceId,
                SECOND_CHAIN_SCOPE.chainId,
            )
            expect(transport.getAddress).toHaveBeenCalledWith(3, false)
            expect(transport.signTransaction).toHaveBeenCalledWith(
                3,
                expect.any(Uint8Array),
            )
        })

        it('reports each device signature as the signer’s base64 signatures, for the multisig cosign transport', async () => {
            const result = await sign(
                groupOf(transfers(2), { originalIndices: [1, 4] }),
            )

            const signature = encodeToBase64(DEVICE_SIGNATURE)
            expect(result.signers).toEqual([
                { address: SIGNER, signatures: [signature, signature] },
            ])
            expect(result.originalIndices).toEqual([1, 4])
        })

        it('signs transactions one after another', async () => {
            const order: string[] = []
            vi.mocked(transport.signTransaction).mockImplementation(
                async () => {
                    order.push('start')
                    await Promise.resolve()
                    order.push('end')
                    return DEVICE_SIGNATURE
                },
            )

            await sign(groupOf(transfers(3)))

            expect(order).toEqual([
                'start',
                'end',
                'start',
                'end',
                'start',
                'end',
            ])
        })

        it('reports start, progress per transaction and completion', async () => {
            const onSigningStart = vi.fn()
            const onProgress = vi.fn()
            const onSigningComplete = vi.fn()

            await sign(groupOf(transfers(3)), {
                onSigningStart,
                onProgress,
                onSigningComplete,
            })

            expect(onSigningStart).toHaveBeenCalledTimes(1)
            expect(onProgress.mock.calls).toEqual([
                [1, 3],
                [2, 3],
                [3, 3],
            ])
            expect(onSigningComplete).toHaveBeenCalledTimes(1)
        })

        it('moves to connecting, then awaiting approval once verified and before each signature', async () => {
            const onPhaseChange = vi.fn()

            await sign(groupOf(transfers(2)), { onPhaseChange })

            expect(onPhaseChange.mock.calls).toEqual([
                ['connecting'],
                ['awaiting-approval'],
                ['awaiting-approval'],
                ['awaiting-approval'],
            ])
        })

        it('routes a USB account to the USB provider', async () => {
            const usb = makeProvider(transport, 'usb')

            await sign(
                groupOf(transfers(1)),
                undefined,
                deviceAccount(0, { deviceId: 'usb-1', transportType: 'usb' }),
                registryOf(usb),
            )

            expect(usb.connect).toHaveBeenCalledWith(
                'usb-1',
                SECOND_CHAIN_SCOPE.chainId,
            )
        })
    })

    describe('group shapes', () => {
        it('returns chain-signer results for a group that shares its request with chain signers', async () => {
            const result = await sign(
                groupOf(transfers(1), { shouldUseChainSigner: true }),
            )

            expect(result.signedData).toEqual({
                type: 'transactions',
                signed: [expect.objectContaining({ bytes: DEVICE_SIGNATURE })],
            })
        })

        it('adds only its signature to a cosign, once per transaction, and leaves assembly to the backend', async () => {
            const twice = (): SigningRequest[] =>
                [0, 1].map(requestIndex => ({
                    requestIndex,
                    signer: SIGNER,
                    scheme: 'ed25519',
                    payload: new Uint8Array([requestIndex]),
                    devicePayload: new Uint8Array([9, requestIndex]),
                }))
            registerFakeTransactionPlanner(fakeTransactionPlanner(twice))
            const cosign: SourceMetadata = {
                type: 'multisig-cosign',
                signRequestId: 'sign-request-1',
            }

            const result = await sign(groupOf(transfers(2), { source: cosign }))

            expect(transport.signTransaction).toHaveBeenCalledTimes(2)
            expect(transport.signTransaction).toHaveBeenCalledWith(
                0,
                new Uint8Array([9, 0]),
            )
            expect(result.signedData).toEqual({
                type: 'transactions',
                signed: [],
            })
            const signature = encodeToBase64(DEVICE_SIGNATURE)
            expect(result.signers).toEqual([
                { address: SIGNER, signatures: [signature, signature] },
            ])
        })
    })

    describe('refusals', () => {
        it.each([
            ['a signer the review never listed', [OTHER], OTHER],
            ['a signer that is not this device', [SIGNER, OTHER], OTHER],
        ])(
            'refuses %s before any device prompt',
            async (_name, reviewed, from) => {
                const group = groupOf([makeUnsignedTransaction(from)], {
                    analysis: {
                        totalFees: 0n,
                        warnings: [],
                        signableAddresses: reviewed,
                        riskLevel: 'low',
                    },
                })

                await expect(sign(group)).rejects.toBeInstanceOf(
                    CannotSignError,
                )
                expect(provider.connect).not.toHaveBeenCalled()
            },
        )

        it('refuses a request its planner gave no device bytes, before any device prompt', async () => {
            registerFakeTransactionPlanner(
                fakeTransactionPlanner(transaction =>
                    planFromPayload(transaction).map(
                        ({ devicePayload: _, ...request }) => request,
                    ),
                ),
            )

            await expect(sign(groupOf(transfers(1)))).rejects.toBeInstanceOf(
                InvalidSignableDataError,
            )
            expect(provider.connect).not.toHaveBeenCalled()
        })

        it('refuses a transaction the planner cannot read', async () => {
            const foreign = makeUnsignedTransaction(SIGNER, {
                chainId: 'algorand',
                networkId: 'mainnet',
            })

            await expect(sign(groupOf([foreign]))).rejects.toBeInstanceOf(
                InvalidSignableDataError,
            )
        })

        it('refuses a group of anything but transactions', async () => {
            const group = {
                ...groupOf([]),
                data: { type: 'arbitrary-data', data: [] },
            } as AnalyzedSignableGroup

            await expect(sign(group)).rejects.toBeInstanceOf(
                InvalidSignableDataError,
            )
        })

        it("does not offer a retry when the planner won't assemble the signatures", async () => {
            vi.mocked(planner.assemble).mockImplementation(() => {
                throw new Error('bad signature')
            })

            await expect(sign(groupOf(transfers(1)))).rejects.toMatchObject({
                constructor: SigningError,
                metadata: expect.objectContaining({ retryable: false }),
            })
        })

        it('throws transport_unavailable with no provider for the device', async () => {
            await expect(
                sign(groupOf(transfers(1)), undefined, deviceAccount(), {
                    getProvider: () => undefined,
                } as unknown as HardwareWalletRegistry),
            ).rejects.toThrow('transport_unavailable')
        })
    })

    describe('session failures', () => {
        it('disconnects and hands onError the classified error when the device fails', async () => {
            vi.mocked(transport.signTransaction).mockRejectedValue(
                new Error('BLE failure'),
            )
            const onError = vi.fn()

            await expect(
                sign(groupOf(transfers(1)), { onError }),
            ).rejects.toThrow('BLE failure')

            expect(transport.disconnect).toHaveBeenCalled()
            expect(onError).toHaveBeenCalledTimes(1)
            expect(onError.mock.calls[0][0]).toBeInstanceOf(SigningError)
        })

        it('keeps the original error when disconnecting also fails', async () => {
            vi.mocked(transport.signTransaction).mockRejectedValue(
                new Error('signing failed'),
            )
            vi.mocked(transport.disconnect).mockRejectedValue(
                new Error('disconnect failed'),
            )

            await expect(sign(groupOf(transfers(1)))).rejects.toThrow(
                'signing failed',
            )
        })

        it('times out a hanging address check', async () => {
            vi.mocked(transport.getAddress).mockImplementation(
                () => new Promise(() => {}),
            )

            await expect(sign(groupOf(transfers(1)))).rejects.toThrow(
                LedgerTimeoutError,
            )
            expect(transport.disconnect).toHaveBeenCalled()
        })

        it('times out a hanging confirmation', async () => {
            vi.mocked(transport.signTransaction).mockImplementation(
                () => new Promise(() => {}),
            )

            await expect(sign(groupOf(transfers(1)))).rejects.toThrow(
                LedgerTimeoutError,
            )
            expect(transport.disconnect).toHaveBeenCalled()
        })

        it('leaves no connect timer behind once connected', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true })
            try {
                await sign(groupOf(transfers(1)))

                expect(vi.getTimerCount()).toBe(0)
            } finally {
                vi.useRealTimers()
            }
        })

        it('reports an unanswered connect as device not found and disconnects a transport that arrives late', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true })
            try {
                let resolveConnect: Optional<
                    (t: HardwareWalletTransport) => void
                >
                vi.mocked(provider.connect).mockImplementation(
                    () =>
                        new Promise<HardwareWalletTransport>(resolve => {
                            resolveConnect = resolve
                        }),
                )

                const signing = sign(groupOf(transfers(1)))
                vi.advanceTimersByTime(LEDGER_CONNECTION_TIMEOUT_MS + 100)
                await expect(signing).rejects.toThrow(LedgerDeviceNotFoundError)

                resolveConnect?.(transport)
                await Promise.resolve()
                await Promise.resolve()
                expect(transport.disconnect).toHaveBeenCalled()
            } finally {
                vi.useRealTimers()
            }
        })

        it('fails as soon as the link drops, without waiting out the confirmation ceiling', async () => {
            let notifyDisconnect: Optional<() => void>
            vi.mocked(transport.signTransaction).mockImplementation(
                () => new Promise(() => {}),
            )
            transport.onDisconnect = listener => {
                notifyDisconnect = listener
                return () => {
                    notifyDisconnect = undefined
                }
            }

            const signing = sign(groupOf(transfers(1)))
            await vi.waitFor(() => expect(notifyDisconnect).toBeDefined())
            notifyDisconnect?.()

            await expect(signing).rejects.toThrow(LedgerDisconnectedError)
        })
    })

    describe('abort', () => {
        it('sends nothing more to the device after an abort mid-group', async () => {
            const controller = new AbortController()
            vi.mocked(transport.signTransaction).mockImplementation(
                async () => {
                    controller.abort()
                    return DEVICE_SIGNATURE
                },
            )

            await expect(
                sign(groupOf(transfers(3)), { signal: controller.signal }),
            ).rejects.toThrow(/abort/i)

            expect(transport.signTransaction).toHaveBeenCalledTimes(1)
            expect(transport.disconnect).toHaveBeenCalled()
        })

        it('disconnects a hanging exchange on abort, which unwinds it', async () => {
            const controller = new AbortController()
            let rejectExchange: (error: Error) => void = () => {}
            vi.mocked(transport.signTransaction).mockImplementation(
                () =>
                    new Promise((_, reject) => {
                        rejectExchange = reject
                    }),
            )
            vi.mocked(transport.disconnect).mockImplementation(async () => {
                rejectExchange(new Error('DisconnectedDeviceDuringOperation'))
            })

            const signing = sign(groupOf(transfers(1)), {
                signal: controller.signal,
            })
            const rejection = expect(signing).rejects.toThrow(
                'DisconnectedDeviceDuringOperation',
            )
            await vi.waitFor(() =>
                expect(transport.signTransaction).toHaveBeenCalledTimes(1),
            )

            controller.abort()
            await rejection
            expect(transport.signTransaction).toHaveBeenCalledTimes(1)
        })

        it('never reaches the device when already aborted', async () => {
            const controller = new AbortController()
            controller.abort()

            await expect(
                sign(groupOf(transfers(1)), { signal: controller.signal }),
            ).rejects.toThrow(/abort/i)

            expect(provider.connect).not.toHaveBeenCalled()
        })
    })
})
