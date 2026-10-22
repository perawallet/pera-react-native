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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

// Shrink the Ledger timeouts for the timeout tests so they run with real
// timers in under 100ms. Keeps the assertions simple (no fake-timer +
// microtask-ordering quirks) while still exercising the real withTimeout
// mechanics against real setTimeout.
vi.mock('@perawallet/wallet-core-ledger', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-ledger')
    return {
        ...actual,
        LEDGER_CONNECTION_TIMEOUT_MS: 50,
        LEDGER_CONFIRMATION_TIMEOUT_MS: 50,
    }
})

import { createHardwareStrategy } from '../createHardwareStrategy'
import {
    fakeMessageSignerAdapter,
    registerFakeMessageSignerAdapter,
} from '../../../__tests__/fakeMessageSignerAdapter'
import { messageSignerChainAdapters } from '../../../message-signer'
import { CannotSignError } from '../../errors'
import { algo25Account, ledgerAccount } from '../../../__tests__/accounts'
import { asUnsignedAlgorandTransaction } from '../../../__tests__/transactions'
import type { AnalyzedSignableGroup } from '../../types'
import type {
    HardwareRef,
    HardwareWalletAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    HardwareWalletTransportProvider,
    HardwareWalletTransport,
    HardwareWalletRegistry,
} from '@perawallet/wallet-core-hardware-wallet'
import { createHardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { LedgerAppOutdatedError } from '@perawallet/wallet-core-ledger'

const SIGNER_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const makeLedgerAccount = (
    address: string = SIGNER_ADDRESS,
    accountIndex: number = 0,
    device: Partial<HardwareRef> = {},
): HardwareWalletAccount =>
    ledgerAccount(address, accountIndex, device) as HardwareWalletAccount

const ethereumLedgerAccount = (): HardwareWalletAccount => ({
    ...makeLedgerAccount(),
    chains: { ethereum: { address: SIGNER_ADDRESS } },
})

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
        transactions: transactions.map(transaction =>
            asUnsignedAlgorandTransaction(transaction as never),
        ),
        chainData: { algorand: { indicesToSign } },
    },
    source: { type: 'local' },
    signerAddress,
    analysis: {
        totalFees: 0n,
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
    signData: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    getAppVersion: vi.fn().mockResolvedValue({ major: 2, minor: 0, patch: 0 }),
    assertCanSignData: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
})

const makeMockProvider = (
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

describe('createHardwareStrategy', () => {
    let mockTransport: HardwareWalletTransport
    let mockProvider: HardwareWalletTransportProvider
    let mockRegistry: HardwareWalletRegistry

    beforeEach(() => {
        mockTransport = makeMockTransport()
        mockProvider = makeMockProvider(mockTransport)
        mockRegistry = makeRegistry(mockProvider)
    })

    describe('canSign', () => {
        it('returns true for hardware wallet accounts', () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            expect(strategy.canSign(makeLedgerAccount())).toBe(true)
        })

        it('returns false for non-hardware accounts', () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            const algo25 = algo25Account(SIGNER_ADDRESS, { keyPairId: 'key-1' })
            expect(strategy.canSign(algo25)).toBe(false)
        })
    })

    const AUTH_DOMAIN = 'example.io'
    const AUTH_DATA_BASE64 = encodeToBase64(new TextEncoder().encode('payload'))
    const AUTH_METADATA = { scope: 1, encoding: 'base64' }

    const makeAuthDataGroup = (): AnalyzedSignableGroup => ({
        data: {
            type: 'auth-data',
            authData: {
                data: AUTH_DATA_BASE64,
                signer: SIGNER_ADDRESS,
                domain: AUTH_DOMAIN,
                authenticatorData: new Uint8Array(37).fill(5),
            },
            metadata: AUTH_METADATA,
        },
        source: { type: 'local' },
        signerAddress: SIGNER_ADDRESS,
        originalIndices: [0],
        analysis: {
            totalFees: 0n,
            warnings: [],
            signableAddresses: [],
            riskLevel: 'low',
        },
    })

    const makeAuthDataTransport = (
        overrides?: Partial<HardwareWalletTransport>,
    ): HardwareWalletTransport => ({
        ...makeMockTransport(),
        ...overrides,
    })

    describe('sign', () => {
        it('refuses transactions, which sign through their planner, without touching the device', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })

            await expect(
                strategy.sign(
                    makeGroup([mockTransaction()], [0]),
                    makeLedgerAccount(),
                ),
            ).rejects.toMatchObject({
                metadata: expect.objectContaining({ retryable: false }),
            })
            expect(mockProvider.connect).not.toHaveBeenCalled()
        })

        it('refuses a message, which no device signs yet', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            const group = {
                ...makeGroup([], []),
                data: { type: 'message' as const, request: {} },
            } as unknown as AnalyzedSignableGroup

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toMatchObject({ reason: 'unsupported_data_type' })
            expect(mockProvider.connect).not.toHaveBeenCalled()
        })

        it('throws CannotSignError for non-hardware wallet accounts', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            const algo25 = algo25Account(SIGNER_ADDRESS, { keyPairId: 'key-1' })

            await expect(
                strategy.sign(makeAuthDataGroup(), algo25),
            ).rejects.toThrow('not a hardware wallet')
        })

        it('throws HardwareWalletError when no transport provider', async () => {
            const strategy = createHardwareStrategy({
                getAllAccounts: () => [],
                chainId: 'algorand',
            })

            await expect(
                strategy.sign(makeAuthDataGroup(), makeLedgerAccount()),
            ).rejects.toThrow('transport_unavailable')
        })

        it('throws SigningError for arbitrary-data (hardware not supported)', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            const group = {
                ...makeGroup([], []),
                data: { type: 'arbitrary-data' as const, data: [] },
            } as unknown as AnalyzedSignableGroup

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toThrow(
                'Hardware wallet signing of arbitrary data is not supported',
            )
            // Retrying can never succeed — no Retry affordance should render.
            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toMatchObject({
                metadata: expect.objectContaining({ retryable: false }),
            })
        })
    })

    describe('auth-data hardware signing', () => {
        it("validates through the strategy chain's message signer, never Algorand's", async () => {
            const transport = makeAuthDataTransport({
                signData: vi.fn().mockResolvedValue(Uint8Array.from([1])),
            })
            const signerPublicKey = vi.fn(() => new Uint8Array(32).fill(0xaa))
            messageSignerChainAdapters.register(
                fakeMessageSignerAdapter({
                    chainId: 'ethereum',
                    authData: { signerPublicKey },
                }),
            )
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(
                    makeMockProvider(transport),
                ),
                getAllAccounts: () => [],
                chainId: 'ethereum',
            })

            await strategy.sign(makeAuthDataGroup(), ethereumLedgerAccount())

            expect(signerPublicKey).toHaveBeenCalledWith(SIGNER_ADDRESS)
        })

        it('signs with a supported app version', async () => {
            const authDataSignature = Uint8Array.from([1, 2, 3])
            const transport = makeAuthDataTransport({
                signData: vi.fn().mockResolvedValue(authDataSignature),
            })
            const KEY = new Uint8Array(32).fill(0xaa)
            const signerPublicKey = vi.fn(() => KEY)
            registerFakeMessageSignerAdapter({ authData: { signerPublicKey } })
            const provider = makeMockProvider(transport)
            const registry = makeRegistry(provider)
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: registry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            const group = makeAuthDataGroup()
            const account = makeLedgerAccount(SIGNER_ADDRESS, 0)

            const result = await strategy.sign(group, account)

            expect(transport.signData).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountIndex: 0,
                    data: AUTH_DATA_BASE64,
                    domain: AUTH_DOMAIN,
                    scope: 1,
                    encoding: 'base64',
                    signerPublicKey: KEY,
                }),
            )
            expect(signerPublicKey).toHaveBeenCalledWith(SIGNER_ADDRESS)
            expect(result).toEqual({
                signedData: { type: 'auth-data', signature: authDataSignature },
                signers: [{ address: SIGNER_ADDRESS }],
                originalIndices: [0],
            })
        })

        it('throws the outdated-app error before validating or prompting', async () => {
            const transport = makeAuthDataTransport({
                assertCanSignData: vi
                    .fn()
                    .mockRejectedValue(new LedgerAppOutdatedError()),
                signData: vi.fn(),
            })
            const onSigningStart = vi.fn()
            const validateAuthData = vi.fn()
            registerFakeMessageSignerAdapter({ authData: { validateAuthData } })
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(
                    makeMockProvider(transport),
                ),
                getAllAccounts: () => [],
                chainId: 'algorand',
            })

            await expect(
                strategy.sign(
                    makeAuthDataGroup(),
                    makeLedgerAccount(SIGNER_ADDRESS, 0),
                    { onSigningStart },
                ),
            ).rejects.toBeInstanceOf(LedgerAppOutdatedError)
            expect(validateAuthData).not.toHaveBeenCalled()
            expect(onSigningStart).not.toHaveBeenCalled()
            expect(transport.signData).not.toHaveBeenCalled()
        })

        it('rejects and does not call signData when host validation fails', async () => {
            const transport = makeAuthDataTransport({
                signData: vi.fn(),
            })
            registerFakeMessageSignerAdapter({
                authData: {
                    validateAuthData: () => {
                        throw new Error('rejected by the chain validator')
                    },
                },
            })
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(
                    makeMockProvider(transport),
                ),
                getAllAccounts: () => [],
                chainId: 'algorand',
            })

            await expect(
                strategy.sign(
                    makeAuthDataGroup(),
                    makeLedgerAccount(SIGNER_ADDRESS, 0),
                ),
            ).rejects.toThrow('rejected by the chain validator')
            expect(transport.signData).not.toHaveBeenCalled()
            expect(transport.disconnect).toHaveBeenCalled()
        })

        it('validates against the accounts current at sign time', async () => {
            const transport = makeAuthDataTransport()
            const account = makeLedgerAccount(SIGNER_ADDRESS, 0)
            const accounts = [{ ...account, name: 'Renamed' } as WalletAccount]
            const validateAuthData = vi.fn(() => ({
                decodedData: new Uint8Array(),
            }))
            registerFakeMessageSignerAdapter({ authData: { validateAuthData } })
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(
                    makeMockProvider(transport),
                ),
                getAllAccounts: () => accounts,
                chainId: 'algorand',
            })
            const group = makeAuthDataGroup()

            await strategy.sign(group, account)

            expect(validateAuthData).toHaveBeenCalledWith(
                group.data.type === 'auth-data' ? group.data.authData : null,
                AUTH_METADATA,
                accounts,
            )
        })

        it('refuses before any device prompt when no message signer is registered', async () => {
            const transport = makeAuthDataTransport()
            const provider = makeMockProvider(transport)
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(provider),
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            messageSignerChainAdapters.reset()

            await expect(
                strategy.sign(
                    makeAuthDataGroup(),
                    makeLedgerAccount(SIGNER_ADDRESS, 0),
                ),
            ).rejects.toBeInstanceOf(CannotSignError)
            expect(provider.connect).not.toHaveBeenCalled()
            expect(transport.assertCanSignData).not.toHaveBeenCalled()
            expect(transport.signData).not.toHaveBeenCalled()
        })

        it('refuses before any device prompt when the chain signs no auth data', async () => {
            const transport = makeAuthDataTransport()
            const provider = makeMockProvider(transport)
            registerFakeMessageSignerAdapter({ authData: null })
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(provider),
                getAllAccounts: () => [],
                chainId: 'algorand',
            })

            await expect(
                strategy.sign(
                    makeAuthDataGroup(),
                    makeLedgerAccount(SIGNER_ADDRESS, 0),
                ),
            ).rejects.toBeInstanceOf(CannotSignError)
            expect(provider.connect).not.toHaveBeenCalled()
            expect(transport.signData).not.toHaveBeenCalled()
        })

        it('still rejects legacy arbitrary-data on hardware', async () => {
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: mockRegistry,
                getAllAccounts: () => [],
                chainId: 'algorand',
            })
            const group = {
                ...makeAuthDataGroup(),
                data: { type: 'arbitrary-data' as const, data: [] },
            } as unknown as AnalyzedSignableGroup

            await expect(
                strategy.sign(group, makeLedgerAccount()),
            ).rejects.toThrow(/arbitrary/i)
        })
    })

    describe('abort', () => {
        it('auth-data: abort during a hanging signData disconnects the transport', async () => {
            const controller = new AbortController()
            let rejectExchange: (error: Error) => void = () => {}
            const transport = makeAuthDataTransport({
                signData: vi.fn(
                    () =>
                        new Promise((_, reject) => {
                            rejectExchange = reject
                        }),
                ),
                disconnect: vi.fn(async () => {
                    rejectExchange(
                        new Error('DisconnectedDeviceDuringOperation'),
                    )
                }),
            })
            const strategy = createHardwareStrategy({
                hardwareWalletRegistry: makeRegistry(
                    makeMockProvider(transport),
                ),
                getAllAccounts: () => [],
                chainId: 'algorand',
            })

            const signPromise = strategy.sign(
                makeAuthDataGroup(),
                makeLedgerAccount(),
                {
                    signal: controller.signal,
                },
            )
            const rejection = expect(signPromise).rejects.toThrow(
                'DisconnectedDeviceDuringOperation',
            )
            await new Promise(resolve => setTimeout(resolve, 0))
            expect(transport.signData).toHaveBeenCalledTimes(1)

            controller.abort()
            await rejection

            expect(transport.disconnect).toHaveBeenCalled()
        })
    })
})
