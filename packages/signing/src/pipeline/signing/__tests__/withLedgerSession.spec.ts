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

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@perawallet/wallet-core-ledger', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-ledger')
    return {
        ...actual,
        LEDGER_CONNECTION_TIMEOUT_MS: 50,
        LEDGER_CONFIRMATION_TIMEOUT_MS: 50,
    }
})

import type { HardwareWalletAccount } from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import {
    SENDER,
    ethereumAddressCodec,
} from '@perawallet/wallet-core-chain-ethereum/testing'
import {
    createHardwareWalletRegistry,
    type HardwareWalletRegistry,
    type HardwareWalletTransport,
    type HardwareWalletTransportProvider,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    LedgerAddressMismatchError,
    LedgerAppOutdatedError,
    LedgerDeviceNotFoundError,
    LedgerDisconnectedError,
} from '@perawallet/wallet-core-ledger'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    HardwareSigningAbortedError,
    HardwareWalletError,
    SigningError,
} from '../../errors'
import { withLedgerSession } from '../withLedgerSession'
import { ledgerAccount } from '../../../__tests__/accounts'

const ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const makeAccount = (): HardwareWalletAccount =>
    ledgerAccount(ADDRESS, 3) as HardwareWalletAccount

const makeTransport = (
    overrides?: Partial<HardwareWalletTransport>,
): HardwareWalletTransport => ({
    getAddress: vi.fn().mockResolvedValue({
        address: ADDRESS,
        publicKey: new Uint8Array(32),
        accountIndex: 3,
    }),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    getAppVersion: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
})

const makeProvider = (
    transport: HardwareWalletTransport,
): HardwareWalletTransportProvider => ({
    manufacturer: 'ledger',
    transportType: 'ble',
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

describe('withLedgerSession', () => {
    let transport: HardwareWalletTransport
    let provider: HardwareWalletTransportProvider
    let registry: HardwareWalletRegistry

    beforeEach(() => {
        transport = makeTransport()
        provider = makeProvider(transport)
        registry = makeRegistry(provider)
    })

    it('runs the operation on a verified session and disconnects afterwards', async () => {
        const onPhaseChange = vi.fn()
        const operation = vi.fn(async () => {
            expect(transport.disconnect).not.toHaveBeenCalled()
            return 'signed'
        })

        const result = await withLedgerSession(
            makeAccount(),
            ADDRESS,
            { registry, chainId: 'algorand', callbacks: { onPhaseChange } },
            operation,
        )

        expect(result).toBe('signed')
        expect(provider.connect).toHaveBeenCalledWith('device-1', 'algorand')
        expect(transport.getAddress).toHaveBeenCalledWith(3, false)
        expect(operation).toHaveBeenCalledWith({
            transport,
            guard: expect.objectContaining({
                race: expect.any(Function),
                dispose: expect.any(Function),
            }),
        })
        expect(onPhaseChange.mock.calls).toEqual([
            ['connecting'],
            ['awaiting-approval'],
        ])
        expect(transport.disconnect).toHaveBeenCalledTimes(1)
    })

    it('connects the device for the session chain', async () => {
        await withLedgerSession(
            makeAccount(),
            ADDRESS,
            { registry, chainId: 'ethereum' },
            vi.fn(),
        )

        expect(provider.connect).toHaveBeenCalledWith('device-1', 'ethereum')
    })

    it('throws transport_unavailable without reporting onError when no provider matches', async () => {
        const onError = vi.fn()
        const operation = vi.fn()

        const promise = withLedgerSession(
            makeAccount(),
            ADDRESS,
            {
                registry: createHardwareWalletRegistry(),
                chainId: 'algorand',
                callbacks: { onError },
            },
            operation,
        )

        await expect(promise).rejects.toBeInstanceOf(HardwareWalletError)
        await expect(promise).rejects.toMatchObject({
            reason: 'transport_unavailable',
        })
        expect(onError).not.toHaveBeenCalled()
        expect(operation).not.toHaveBeenCalled()
    })

    it('does not connect when the signal is already aborted', async () => {
        const controller = new AbortController()
        controller.abort()
        const onError = vi.fn()

        await expect(
            withLedgerSession(
                makeAccount(),
                ADDRESS,
                {
                    registry,
                    chainId: 'algorand',
                    callbacks: { signal: controller.signal, onError },
                },
                vi.fn(),
            ),
        ).rejects.toBeInstanceOf(HardwareSigningAbortedError)
        expect(provider.connect).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith(
            expect.any(HardwareSigningAbortedError),
        )
    })

    it('disconnects and skips the operation when the device address does not match', async () => {
        vi.mocked(transport.getAddress).mockResolvedValue({
            address: 'OTHER',
            publicKey: new Uint8Array(32),
            accountIndex: 3,
        })
        const onError = vi.fn()
        const operation = vi.fn()

        await expect(
            withLedgerSession(
                makeAccount(),
                ADDRESS,
                { registry, chainId: 'algorand', callbacks: { onError } },
                operation,
            ),
        ).rejects.toBeInstanceOf(LedgerAddressMismatchError)
        expect(operation).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalledWith(
            expect.any(LedgerAddressMismatchError),
        )
        expect(transport.disconnect).toHaveBeenCalled()
    })

    describe('address check', () => {
        const CHECKSUMMED = SENDER
        const LOWERCASE = SENDER.toLowerCase()

        beforeEach(() => {
            addressCodecs.reset()
            addressCodecs.register(ethereumAddressCodec)
        })

        afterEach(() => {
            addressCodecs.reset()
        })

        it.each([
            [
                'a checksummed device address for a lowercase-stored account',
                CHECKSUMMED,
                LOWERCASE,
            ],
            [
                'a lowercase device address for a checksummed account',
                LOWERCASE,
                CHECKSUMMED,
            ],
        ])('accepts %s', async (_name, device, stored) => {
            vi.mocked(transport.getAddress).mockResolvedValue({
                address: device,
                publicKey: new Uint8Array(65),
                accountIndex: 3,
            })

            await expect(
                withLedgerSession(
                    makeAccount(),
                    stored,
                    { registry, chainId: 'ethereum' },
                    async () => 'signed',
                ),
            ).resolves.toBe('signed')
        })

        it('still refuses a different address', async () => {
            vi.mocked(transport.getAddress).mockResolvedValue({
                address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                publicKey: new Uint8Array(65),
                accountIndex: 3,
            })
            const operation = vi.fn()

            await expect(
                withLedgerSession(
                    makeAccount(),
                    LOWERCASE,
                    { registry, chainId: 'ethereum' },
                    operation,
                ),
            ).rejects.toBeInstanceOf(LedgerAddressMismatchError)
            expect(operation).not.toHaveBeenCalled()
            expect(transport.disconnect).toHaveBeenCalled()
        })
    })

    it('reports a connect that never completes as device-not-found', async () => {
        vi.mocked(provider.connect).mockReturnValue(new Promise(() => {}))

        await expect(
            withLedgerSession(
                makeAccount(),
                ADDRESS,
                { registry, chainId: 'algorand' },
                vi.fn(),
            ),
        ).rejects.toBeInstanceOf(LedgerDeviceNotFoundError)
    })

    it('passes Ledger errors from the operation through unwrapped', async () => {
        const onError = vi.fn()

        await expect(
            withLedgerSession(
                makeAccount(),
                ADDRESS,
                { registry, chainId: 'algorand', callbacks: { onError } },
                async () => {
                    throw new LedgerAppOutdatedError()
                },
            ),
        ).rejects.toBeInstanceOf(LedgerAppOutdatedError)
        expect(onError).toHaveBeenCalledWith(expect.any(LedgerAppOutdatedError))
    })

    it('wraps other operation errors in SigningError, preserving the message', async () => {
        const onError = vi.fn()

        const promise = withLedgerSession(
            makeAccount(),
            ADDRESS,
            { registry, chainId: 'algorand', callbacks: { onError } },
            async () => {
                throw new Error('boom')
            },
        )

        await expect(promise).rejects.toBeInstanceOf(SigningError)
        await expect(promise).rejects.toThrow('boom')
        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError.mock.calls[0][0]).toBeInstanceOf(SigningError)
        expect(transport.disconnect).toHaveBeenCalledTimes(1)
    })

    it('disposes the disconnect guard before disconnecting', async () => {
        const order: string[] = []
        transport = makeTransport({
            onDisconnect: vi.fn(() => () => {
                order.push('unsubscribe')
            }),
            disconnect: vi.fn(async () => {
                order.push('disconnect')
            }),
        })
        registry = makeRegistry(makeProvider(transport))

        await withLedgerSession(
            makeAccount(),
            ADDRESS,
            { registry, chainId: 'algorand' },
            async () => 'ok',
        )

        expect(order).toEqual(['unsubscribe', 'disconnect'])
    })

    it('rejects a pending exchange as soon as the link drops', async () => {
        let fireDisconnect: () => void = () => {}
        transport = makeTransport({
            onDisconnect: vi.fn(listener => {
                fireDisconnect = listener
                return () => {}
            }),
        })
        registry = makeRegistry(makeProvider(transport))

        await expect(
            withLedgerSession(
                makeAccount(),
                ADDRESS,
                { registry, chainId: 'algorand' },
                ({ guard }) => {
                    const pending = guard.race(new Promise<never>(() => {}))
                    fireDisconnect()
                    return pending
                },
            ),
        ).rejects.toBeInstanceOf(LedgerDisconnectedError)
    })

    it('disconnects on abort mid-operation and stops listening once torn down', async () => {
        const controller = new AbortController()
        const addListener = vi.spyOn(controller.signal, 'addEventListener')
        const removeListener = vi.spyOn(
            controller.signal,
            'removeEventListener',
        )
        let release: Optional<() => void>

        const promise = withLedgerSession(
            makeAccount(),
            ADDRESS,
            {
                registry,
                chainId: 'algorand',
                callbacks: { signal: controller.signal },
            },
            () =>
                new Promise<string>(resolve => {
                    release = () => resolve('done')
                }),
        )
        await vi.waitFor(() => expect(release).toBeDefined())

        controller.abort()
        expect(transport.disconnect).toHaveBeenCalledTimes(1)

        release?.()
        await expect(promise).resolves.toBe('done')
        expect(transport.disconnect).toHaveBeenCalledTimes(2)

        const [, abortListener] = addListener.mock.calls[0]
        expect(removeListener).toHaveBeenCalledWith('abort', abortListener)
    })

    it('swallows a teardown disconnect failure so the original outcome surfaces', async () => {
        vi.mocked(transport.disconnect).mockRejectedValue(new Error('ble gone'))

        await expect(
            withLedgerSession(
                makeAccount(),
                ADDRESS,
                { registry, chainId: 'algorand' },
                async () => 'ok',
            ),
        ).resolves.toBe('ok')
    })
})
