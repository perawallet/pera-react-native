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

import {
    hashTypedData,
    recoverAddress,
    recoverMessageAddress,
    recoverTypedDataAddress,
    toHex,
} from 'viem'
import type { Hex, TypedDataDefinition } from 'viem'
import { describe, expect, it } from 'vitest'
import {
    parseDomainChainId,
    personalSignMessageRequest,
    typedDataMessageRequest,
} from '@perawallet/wallet-core-chain-ethereum/signing/messages'

import { createRawKeyEvmAccount } from '../../harness/accounts'
import {
    castSignMessage,
    castSignTypedData,
    castVerifyMessage,
} from '../../harness/cast'
import { SECP256K1_HALF_ORDER } from '../../harness/curve'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { signMessageWithApp } from '../../harness/sign'
import { rejectionOf } from '../../harness/submit'
import { EIP712_MAIL_VECTOR } from '../../vectors/knownAnswerVectors'

const sepoliaChainId = EVMNET.ethereum.eip155ChainId

const typedDataFor = (chainId: number) =>
    ({
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            Asset: [
                { name: 'id', type: 'uint256' },
                { name: 'tag', type: 'bytes' },
            ],
            Person: [
                { name: 'name', type: 'string' },
                { name: 'wallet', type: 'address' },
            ],
            Order: [
                { name: 'maker', type: 'Person' },
                { name: 'assets', type: 'Asset[]' },
                { name: 'amount', type: 'uint256' },
                { name: 'memo', type: 'string' },
            ],
        },
        primaryType: 'Order',
        domain: {
            name: 'Conformance Exchange',
            version: '2',
            chainId,
            verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
        },
        message: {
            maker: {
                name: 'Alice',
                wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            },
            assets: [
                { id: '1', tag: '0xdeadbeef' },
                { id: '9007199254740993', tag: '0x' },
            ],
            // Above 2^53.
            amount: '123456789012345678901234567890',
            memo: 'nested struct, array, bytes and a wide uint',
        },
    }) as const

/**
 * Proves the app's personal_sign and EIP-712 signatures are the ones cast
 * produces for the same message, recover to the signing account, and that the
 * signer refuses typed data bound to another chain's domain. A mocked signer
 * can't show the digest construction or the 65-byte `r‖s‖v` assembly.
 */
describe('evm message signing conformance', () => {
    describe('personal_sign', () => {
        it.each([
            ['a UTF-8 string', 'Sign in to Pera ✓ é世界', undefined],
            ['an empty string', '', undefined],
            ['raw hex bytes', '0x00ff10deadbeef', '0x00ff10deadbeef' as Hex],
        ])(
            'signs %s as cast does and recovers the account',
            async (_label, text, hex) => {
                const env = await createEvmConformanceEnv('ethereum')
                const account = await createRawKeyEvmAccount(env)
                const message: Hex = hex ?? toHex(text)

                const signature = await signMessageWithApp(
                    env,
                    account,
                    personalSignMessageRequest(
                        env.scope,
                        account.address,
                        message,
                    ),
                )

                // Oracle parity: cast signs the same text or bytes.
                expect(signature).toEqual(
                    await castSignMessage({
                        privateKey: account.privateKey,
                        message: hex ?? (text === '' ? '0x' : text),
                    }),
                )
                expect(['1b', '1c']).toContain(signature.slice(-2))
                const s = BigInt(`0x${signature.slice(66, 130)}`)
                expect(s).toBeLessThanOrEqual(SECP256K1_HALF_ORDER)
                // Round-trip: viem and cast both recover the account.
                expect(
                    await recoverMessageAddress({
                        message: { raw: message },
                        signature,
                    }),
                ).toBe(account.address)
                expect(
                    await castVerifyMessage({
                        address: account.address,
                        message: hex ?? (text === '' ? '0x' : text),
                        signature,
                    }),
                ).toBe(true)
            },
        )
    })

    describe('eth_signTypedData_v4', () => {
        it('signs nested structs, arrays, bytes and a wide uint as cast does', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const account = await createRawKeyEvmAccount(env)
            const typedData = typedDataFor(sepoliaChainId)

            const signature = await signMessageWithApp(
                env,
                account,
                typedDataMessageRequest(env.scope, account.address, typedData),
            )

            // Oracle parity
            expect(signature).toEqual(
                await castSignTypedData({
                    privateKey: account.privateKey,
                    typedData,
                }),
            )
            expect(['1b', '1c']).toContain(signature.slice(-2))
            // Round-trip
            expect(
                await recoverTypedDataAddress({
                    ...(typedData as unknown as TypedDataDefinition),
                    signature,
                }),
            ).toBe(account.address)
            expect(
                await recoverAddress({
                    hash: hashTypedData(
                        typedData as unknown as TypedDataDefinition,
                    ),
                    signature,
                }),
            ).toBe(account.address)
        })

        it('signs a domain declared with a string chainId on the same digest as a numeric one', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const account = await createRawKeyEvmAccount(env)
            const numeric = typedDataFor(sepoliaChainId)
            const textual = {
                ...numeric,
                domain: { ...numeric.domain, chainId: String(sepoliaChainId) },
            }

            const signature = await signMessageWithApp(
                env,
                account,
                typedDataMessageRequest(env.scope, account.address, textual),
            )

            expect(signature).toEqual(
                await castSignTypedData({
                    privateKey: account.privateKey,
                    typedData: numeric,
                }),
            )
        })

        it('refuses the EIP-712 Mail example on a foreign domain and signs it on this chain as cast does', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const account = await createRawKeyEvmAccount(
                env,
                EIP712_MAIL_VECTOR.privateKey,
            )
            expect(account.address).toBe(EIP712_MAIL_VECTOR.address)
            // The vector's domain is chain 1; sign it on a scope whose chain it names.
            const onThisChain = {
                ...EIP712_MAIL_VECTOR.typedData,
                domain: {
                    ...EIP712_MAIL_VECTOR.typedData.domain,
                    chainId: sepoliaChainId,
                },
            }

            const refusal = await rejectionOf(() =>
                signMessageWithApp(
                    env,
                    account,
                    typedDataMessageRequest(
                        env.scope,
                        account.address,
                        EIP712_MAIL_VECTOR.typedData,
                    ),
                ),
            )
            expect((refusal as Error).message).toBe(
                `The typed data is for EIP-155 chain 1, not ${env.scope.networkId}`,
            )

            // Same vector on this scope's chain id: cast and the app agree.
            const signature = await signMessageWithApp(
                env,
                account,
                typedDataMessageRequest(
                    env.scope,
                    account.address,
                    onThisChain,
                ),
            )
            expect(signature).toEqual(
                await castSignTypedData({
                    privateKey: EIP712_MAIL_VECTOR.privateKey,
                    typedData: onThisChain,
                }),
            )
        })

        it('refuses typed data whose domain chainId is another chain, however it is spelled', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const account = await createRawKeyEvmAccount(env)
            const foreign = EVMNET.base.eip155ChainId

            for (const chainId of [
                foreign,
                String(foreign),
                `0x${foreign.toString(16)}`,
                BigInt(foreign),
            ]) {
                const typedData = {
                    ...typedDataFor(sepoliaChainId),
                    domain: {
                        ...typedDataFor(sepoliaChainId).domain,
                        chainId,
                    },
                }
                const refusal = await rejectionOf(() =>
                    signMessageWithApp(
                        env,
                        account,
                        typedDataMessageRequest(
                            env.scope,
                            account.address,
                            typedData,
                        ),
                    ),
                )
                // The message echoes the dApp's own spelling of the id.
                expect((refusal as Error).message).toBe(
                    `The typed data is for EIP-155 chain ${chainId}, not ${env.scope.networkId}`,
                )
            }
        })

        it('signs typed data with no domain chainId, as cast does', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const account = await createRawKeyEvmAccount(env)
            const base = typedDataFor(sepoliaChainId)
            const { chainId: _omitted, ...domain } = base.domain
            const typedData = {
                ...base,
                types: {
                    ...base.types,
                    EIP712Domain: base.types.EIP712Domain.filter(
                        field => field.name !== 'chainId',
                    ),
                },
                domain,
            }

            // EIP-712 makes chainId optional; such a signature is bound to no chain, so a
            // policy change that starts refusing it must show up here.
            expect(
                await signMessageWithApp(
                    env,
                    account,
                    typedDataMessageRequest(
                        env.scope,
                        account.address,
                        typedData,
                    ),
                ),
            ).toEqual(
                await castSignTypedData({
                    privateKey: account.privateKey,
                    typedData,
                }),
            )
        })

        it('parses a domain chainId from number, bigint, decimal and hex text', () => {
            expect(parseDomainChainId(undefined)).toBeUndefined()
            for (const input of [84_532, 84_532n, '84532', '0x14a34']) {
                expect(parseDomainChainId(input)).toBe(84_532n)
            }
            expect(() => parseDomainChainId({})).toThrow(
                'The typed-data message payload is malformed',
            )
            expect(() => parseDomainChainId('not a number')).toThrow(
                'The typed-data message payload is malformed',
            )
        })
    })
})
