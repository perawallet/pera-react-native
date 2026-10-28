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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    bytesToHex,
    concat,
    hashMessage,
    hashTypedData,
    hexToBytes,
    keccak256,
    recoverTransactionAddress,
    serializeTransaction,
    toHex,
    verifyMessage,
    verifyTypedData,
} from 'viem'
import type { TypedDataDefinition } from 'viem'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Hex, TransactionSerializableEIP1559 } from 'viem'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { InvalidSignableDataError } from '@perawallet/wallet-core-signing'

const mocks = vi.hoisted(() => ({
    constructed: vi.fn(),
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
    getAppConfiguration: vi.fn(),
    resolveTransaction: vi.fn(),
    signPersonalMessage: vi.fn(),
    signEIP712Message: vi.fn(),
    signEIP712HashedMessage: vi.fn(),
}))

vi.mock('@ledgerhq/hw-app-eth', () => ({
    default: class {
        constructor(transport: unknown) {
            mocks.constructed(transport)
        }
        loadConfig = {}
        ledgerService = { resolveTransaction: mocks.resolveTransaction }
        getAddress = mocks.getAddress
        signTransaction = mocks.signTransaction
        getAppConfiguration = mocks.getAppConfiguration
        signPersonalMessage = mocks.signPersonalMessage
        signEIP712Message = mocks.signEIP712Message
        signEIP712HashedMessage = mocks.signEIP712HashedMessage
    },
}))

import {
    LedgerAppNotOpenError,
    LedgerBlindSigningRequiredError,
    LedgerConnectionError,
    LedgerDeviceBusyError,
    LedgerSigningError,
    LedgerUserRejectedError,
} from '@perawallet/wallet-extension-ledger-shared'
import { createEvmPlannerAdapter } from '../../signing/adapter'
import {
    createEvmMessageSignerAdapter,
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '../../signing/messages'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'
import {
    ERC20_TRANSFER,
    MAIL_TYPED_DATA,
    SENDER,
    TRANSFER,
    VIEM_ERC20_TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_2,
    vectorSignature,
} from '../../signing/__tests__/fixtures'
import { createEvmLedgerAppDriver } from '../driver'

const ethereumLedgerAppDriver = createEvmLedgerAppDriver(ETHEREUM)

// Hardhat #0's uncompressed public key, as the app returns it (no `0x`).
const HARDHAT_PUBLIC_KEY =
    '048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5'

const RESOLUTION = { erc20Tokens: ['token'] }

const { plan, assemble } = createEvmPlannerAdapter(ETHEREUM)

const unsigned = (
    transaction: TransactionSerializableEIP1559,
): UnsignedTransaction => ({
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    payload: { from: SENDER, transaction },
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

const unsignedHex = (transaction: TransactionSerializableEIP1559): Hex =>
    serializeTransaction({ ...transaction, type: 'eip1559' })

// What hw-app-eth hands back for a typed transaction: `v` is the y-parity.
const deviceSignature = (transaction: TransactionSerializableEIP1559) => {
    const bytes = vectorSignature(plan(unsigned(transaction))[0].payload)
    const hex = bytesToHex(bytes).slice(2)
    return {
        r: hex.slice(0, 64),
        s: hex.slice(64, 128),
        v: hex.slice(128),
    }
}

describe('ethereumLedgerAppDriver', () => {
    const raw = { close: vi.fn() }
    const open = () => ethereumLedgerAppDriver.open(raw)

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getAddress.mockResolvedValue({
            address: SENDER.toLowerCase(),
            publicKey: HARDHAT_PUBLIC_KEY,
        })
        mocks.resolveTransaction.mockResolvedValue(RESOLUTION)
        mocks.signTransaction.mockResolvedValue(deviceSignature(TRANSFER))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('is keyed by the Ethereum chain and opens the app over the given transport', () => {
        open()

        expect(ethereumLedgerAppDriver.chainId).toBe('ethereum')
        expect(createEvmLedgerAppDriver(BASE).chainId).toBe('base')
        expect(mocks.constructed).toHaveBeenCalledWith(raw)
    })

    it('opens the Ethereum device app on every EVM chain', () => {
        expect(ethereumLedgerAppDriver.appName).toBe('Ethereum')
        expect(createEvmLedgerAppDriver(BASE).appName).toBe('Ethereum')
    })

    describe('getAddress', () => {
        it('reads the Ledger Live path, checksums the address and returns the 65-byte key', async () => {
            const account = await open().getAddress(0)

            expect(mocks.getAddress).toHaveBeenCalledWith(
                "m/44'/60'/0'/0/0",
                false,
            )
            expect(account).toEqual({
                address: SENDER,
                publicKey: hexToBytes(`0x${HARDHAT_PUBLIC_KEY}`),
                accountIndex: 0,
            })
            expect(account.publicKey).toHaveLength(65)
        })

        it('moves along the account level of the path and passes verify through', async () => {
            await open().getAddress(3, true)

            expect(mocks.getAddress).toHaveBeenCalledWith(
                "m/44'/60'/3'/0/0",
                true,
            )
        })
    })

    describe('signTransaction', () => {
        it.each([
            ['a native transfer', TRANSFER, VIEM_TRANSFER_NONCE_0],
            ['an ERC-20 transfer', ERC20_TRANSFER, VIEM_ERC20_TRANSFER],
            [
                'a transfer whose signature has parity 0',
                { ...TRANSFER, nonce: 2 },
                VIEM_TRANSFER_NONCE_2,
            ],
        ])(
            'returns bytes the planner assembles into what viem signs, for %s',
            async (_name, transaction, expected) => {
                mocks.signTransaction.mockResolvedValue(
                    deviceSignature(transaction),
                )

                const bytes = await open().signTransaction(
                    0,
                    hexToBytes(unsignedHex(transaction)),
                )
                const signed = await assemble(unsigned(transaction), [
                    {
                        requestIndex: 0,
                        signer: SENDER,
                        scheme: 'secp256k1',
                        bytes,
                    },
                ])

                expect(bytes).toHaveLength(65)
                expect(bytesToHex(signed.bytes)).toBe(expected)
                await expect(
                    recoverTransactionAddress({
                        serializedTransaction: bytesToHex(
                            signed.bytes,
                        ) as `0x02${string}`,
                    }),
                ).resolves.toBe(SENDER)
                expect(mocks.signTransaction).toHaveBeenCalledWith(
                    "m/44'/60'/0'/0/0",
                    unsignedHex(transaction).slice(2),
                    RESOLUTION,
                )
            },
        )

        it('resolves descriptors for the unprefixed hex, with only ERC-20 resolution on', async () => {
            await open().signTransaction(0, hexToBytes(unsignedHex(TRANSFER)))

            expect(mocks.resolveTransaction).toHaveBeenCalledWith(
                unsignedHex(TRANSFER).slice(2),
                {},
                {
                    erc20: true,
                    externalPlugins: false,
                    nft: false,
                    uniswapV3: false,
                },
            )
        })

        it('signs without descriptors when resolution fails, and logs no transaction', async () => {
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            mocks.resolveTransaction.mockRejectedValue(new Error('offline'))

            await open().signTransaction(0, hexToBytes(unsignedHex(TRANSFER)))

            expect(mocks.signTransaction).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                null,
            )
            expect(JSON.stringify(warn.mock.calls)).not.toContain(
                unsignedHex(TRANSFER).slice(2),
            )
        })

        it('signs without descriptors when resolution never settles', async () => {
            vi.useFakeTimers()
            vi.spyOn(logger, 'warn').mockImplementation(() => {})
            mocks.resolveTransaction.mockReturnValue(new Promise(() => {}))

            const signing = open().signTransaction(
                0,
                hexToBytes(unsignedHex(TRANSFER)),
            )
            await vi.advanceTimersByTimeAsync(10_000)
            await signing

            expect(mocks.signTransaction).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                null,
            )
        })

        it.each([
            ['an unexpected parity', { ...deviceSignature(TRANSFER), v: '1b' }],
            ['a short r', { ...deviceSignature(TRANSFER), r: 'ab'.repeat(31) }],
            ['a long s', { ...deviceSignature(TRANSFER), s: 'ab'.repeat(33) }],
        ])(
            'refuses %s rather than returning a malformed signature',
            async (_n, signature) => {
                mocks.signTransaction.mockResolvedValue(signature)

                await expect(
                    open().signTransaction(
                        0,
                        hexToBytes(unsignedHex(TRANSFER)),
                    ),
                ).rejects.toBeInstanceOf(LedgerSigningError)
            },
        )
    })

    describe('getAppVersion', () => {
        it('splits the dotted version', async () => {
            mocks.getAppConfiguration.mockResolvedValue({ version: '1.10.4' })

            await expect(open().getAppVersion()).resolves.toEqual({
                major: 1,
                minor: 10,
                patch: 4,
            })
        })
    })

    describe('error classification', () => {
        const failWith = (error: unknown) => {
            mocks.getAddress.mockRejectedValue(error)
            return open().getAddress(0)
        }

        it('classifies 0x6a80 as blind signing required, naming the app', async () => {
            const error = await failWith({ statusCode: 0x6a80 }).catch(e => e)

            expect(error).toBeInstanceOf(LedgerBlindSigningRequiredError)
            expect(error.appName).toBe('Ethereum')
        })

        it("classifies the library's remapped contract-data error the same way", async () => {
            const remapped = new Error('Please enable Blind signing')
            remapped.name = 'EthAppPleaseEnableContractData'
            mocks.signTransaction.mockRejectedValue(remapped)

            const error = await open()
                .signTransaction(0, hexToBytes(unsignedHex(TRANSFER)))
                .catch(e => e)

            expect(error).toBeInstanceOf(LedgerBlindSigningRequiredError)
            expect(error.appName).toBe('Ethereum')
            expect(error.originalError).toBe(remapped)
        })

        it('names the Ethereum app when it is not open', async () => {
            const error = await failWith({ statusCode: 0x6e00 }).catch(e => e)

            expect(error).toBeInstanceOf(LedgerAppNotOpenError)
            expect(error.message).toBe(
                'Ethereum app is not open on the Ledger device',
            )
        })

        it('classifies 0x6985 as a user rejection', async () => {
            await expect(
                failWith({ statusCode: 0x6985 }),
            ).rejects.toBeInstanceOf(LedgerUserRejectedError)
        })

        it('hands anything else to the transport classifier', async () => {
            const failure = new Error('transport-specific')
            mocks.getAddress.mockRejectedValue(failure)
            const classifyError = vi.fn(() => new LedgerDeviceBusyError())

            await expect(
                ethereumLedgerAppDriver.open(raw, classifyError).getAddress(0),
            ).rejects.toBeInstanceOf(LedgerDeviceBusyError)
            expect(classifyError).toHaveBeenCalledWith(failure)
        })
    })

    describe('signMessage', () => {
        const messages = createEvmMessageSignerAdapter(ETHEREUM)
        const MAINNET = { chainId: 'ethereum', networkId: 'mainnet' }
        const ledger = {
            id: 'ledger',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'd1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
            chains: { ethereum: { address: SENDER } },
        } as WalletAccount
        const mail = MAIL_TYPED_DATA as unknown as TypedDataDefinition
        const HELLO = toHex('hello world')

        // What the app hands back for a message: `v` is 27 or 28.
        const appSignature = (digest: Hex) => {
            const hex = bytesToHex(vectorSignature(hexToBytes(digest))).slice(2)
            return {
                r: hex.slice(0, 64),
                s: hex.slice(64, 128),
                v: 27 + Number.parseInt(hex.slice(128), 16),
            }
        }

        const signThroughDriver = async (
            request: ReturnType<typeof personalSignMessageRequest>,
        ) => {
            const [item] = messages.plan(request, {
                account: ledger,
                accounts: [ledger],
            })
            const bytes = await open().signMessage(3, item.devicePayload!)
            const signed = await messages.assemble(request, [
                {
                    requestIndex: 0,
                    signer: item.signer,
                    scheme: item.scheme,
                    bytes,
                },
            ])
            return bytesToHex(signed.signature.bytes)
        }

        const unsupported = Object.assign(new Error('INS not supported'), {
            statusCode: 0x6d00,
        })

        beforeEach(() => {
            mocks.signPersonalMessage.mockResolvedValue(
                appSignature(hashMessage({ raw: HELLO })),
            )
            mocks.signEIP712Message.mockResolvedValue(
                appSignature(hashTypedData(mail)),
            )
            mocks.signEIP712HashedMessage.mockImplementation(
                async (
                    _path: string,
                    domainSeparator: string,
                    structHash: string,
                ) =>
                    appSignature(
                        keccak256(
                            concat([
                                '0x1901',
                                `0x${domainSeparator}`,
                                `0x${structHash}`,
                            ]),
                        ),
                    ),
            )
        })

        it('signs personal_sign with signPersonalMessage and returns a signature viem verifies', async () => {
            const signature = await signThroughDriver(
                personalSignMessageRequest(MAINNET, SENDER, HELLO),
            )

            expect(mocks.signPersonalMessage).toHaveBeenCalledWith(
                "m/44'/60'/3'/0/0",
                HELLO.slice(2),
            )
            await expect(
                verifyMessage({
                    address: SENDER,
                    message: 'hello world',
                    signature,
                }),
            ).resolves.toBe(true)
        })

        it('signs typed data in full EIP-712 mode and returns a signature viem verifies', async () => {
            const signature = await signThroughDriver(
                typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
            )

            expect(mocks.signEIP712Message).toHaveBeenCalledWith(
                "m/44'/60'/3'/0/0",
                expect.objectContaining({
                    primaryType: 'Mail',
                    types: expect.objectContaining({
                        EIP712Domain: expect.any(Array),
                    }),
                }),
            )
            expect(mocks.signEIP712HashedMessage).not.toHaveBeenCalled()
            await expect(
                verifyTypedData({ address: SENDER, signature, ...mail }),
            ).resolves.toBe(true)
        })

        it('falls back to hashed mode when the app reports no full EIP-712 support, and the result still verifies', async () => {
            mocks.signEIP712Message.mockRejectedValue(unsupported)

            const signature = await signThroughDriver(
                typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
            )

            expect(mocks.signEIP712HashedMessage).toHaveBeenCalledTimes(1)
            const [, domainSeparator, structHash] =
                mocks.signEIP712HashedMessage.mock.calls[0]
            expect(domainSeparator).toMatch(/^[0-9a-f]{64}$/)
            expect(structHash).toMatch(/^[0-9a-f]{64}$/)
            await expect(
                verifyTypedData({ address: SENDER, signature, ...mail }),
            ).resolves.toBe(true)
        })

        it('does not fall back when the user rejects typed data on the device', async () => {
            mocks.signEIP712Message.mockRejectedValue({ statusCode: 0x6985 })

            await expect(
                signThroughDriver(
                    typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
                ),
            ).rejects.toBeInstanceOf(LedgerUserRejectedError)
            expect(mocks.signEIP712HashedMessage).not.toHaveBeenCalled()
        })

        // Full mode can fail host-side, before any APDU (an unencodable type);
        // a hashed retry would then be a second prompt for the same request.
        it('does not fall back when full mode fails without a status word', async () => {
            mocks.signEIP712Message.mockRejectedValue(
                new Error('Type "uint7" is not supported'),
            )

            await expect(
                signThroughDriver(
                    typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
                ),
            ).rejects.toBeInstanceOf(LedgerConnectionError)
            expect(mocks.signEIP712HashedMessage).not.toHaveBeenCalled()
        })

        it('reports blind signing required when hashed mode needs it', async () => {
            mocks.signEIP712Message.mockRejectedValue(unsupported)
            mocks.signEIP712HashedMessage.mockRejectedValue({
                statusCode: 0x6a80,
            })

            await expect(
                signThroughDriver(
                    typedDataMessageRequest(MAINNET, SENDER, MAIL_TYPED_DATA),
                ),
            ).rejects.toBeInstanceOf(LedgerBlindSigningRequiredError)
        })

        it('refuses a v other than 27 or 28', async () => {
            mocks.signPersonalMessage.mockResolvedValue({
                ...appSignature(hashMessage({ raw: HELLO })),
                v: 1,
            })

            await expect(
                signThroughDriver(
                    personalSignMessageRequest(MAINNET, SENDER, HELLO),
                ),
            ).rejects.toBeInstanceOf(LedgerSigningError)
        })

        it('refuses a signature that does not recover to the planned signer over the planned digest', async () => {
            mocks.signPersonalMessage.mockResolvedValue(
                appSignature(hashTypedData(mail)),
            )

            await expect(
                signThroughDriver(
                    personalSignMessageRequest(MAINNET, SENDER, HELLO),
                ),
            ).rejects.toBeInstanceOf(LedgerSigningError)
        })

        it('refuses a payload that is not an Ethereum Ledger message, without retry and without touching the app', async () => {
            const error = await open()
                .signMessage(0, new Uint8Array([1, 2, 3]))
                .catch((e: unknown) => e)

            expect(error).toBeInstanceOf(InvalidSignableDataError)
            expect((error as InvalidSignableDataError).metadata.retryable).toBe(
                false,
            )
            expect(mocks.signPersonalMessage).not.toHaveBeenCalled()
            expect(mocks.signEIP712Message).not.toHaveBeenCalled()
        })
    })
})
