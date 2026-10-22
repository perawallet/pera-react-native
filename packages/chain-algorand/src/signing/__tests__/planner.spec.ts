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

import { describe, it, expect } from 'vitest'
import { Address, assignGroupID, type Transaction } from 'algosdk'
import nacl from 'tweetnacl'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type Signature,
    type SigningRequest,
    type UnsignedTransaction,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { transactionPlannerContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import { encodeSignedTransaction } from '../../blockchain/utils/transact'
import { generateMultisigAddress } from '../../multisig/address'
import { assembleSignedMultisigTransactions } from '../../multisig/assemble'
import { encodeTransactionRaw } from '../../blockchain'
import { signTransactionsWithLocalKey } from '../local-key/signTransactionsWithLocalKey'
import {
    algorandTransactionPlanner,
    type AlgorandTransactionPayload,
} from '../planner'
import { makeTestPaymentTx } from './transactions'
import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'

const MAINNET_GENESIS = decodeFromBase64(
    getAlgorandChainConfig({
        chainId: LEGACY_CHAIN_ID,
        networkId: 'mainnet',
    } as const).genesisHash,
)

const keyPairOf = (byte: number): nacl.SignKeyPair =>
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(byte))
const addressOf = (keys: nacl.SignKeyPair): string =>
    new Address(keys.publicKey).toString()

const ALICE = keyPairOf(1)
const BOB = keyPairOf(2)
const CAROL = keyPairOf(3)
const KEYS = new Map(
    [ALICE, BOB, CAROL].map(keys => [addressOf(keys), keys] as const),
)

const payment = (sender: string, amount = 5n): Transaction =>
    makeTestPaymentTx(Address.fromString(sender), {
        receiver: Address.fromString(addressOf(CAROL)),
        amount,
        genesisHash: MAINNET_GENESIS,
    })

const unsigned = (payload: unknown): UnsignedTransaction => ({
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    payload,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'algorand' },
})

const signWith = (request: SigningRequest): Uint8Array => {
    const keys = KEYS.get(request.signer)
    if (!keys) throw new Error(`no key for ${request.signer}`)
    return nacl.sign.detached(request.payload, keys.secretKey)
}

/** Plans, signs what the given keys hold, and assembles. */
const throughPlanner = async (
    transaction: UnsignedTransaction,
    holds: (signer: string) => boolean = () => true,
): Promise<Uint8Array> => {
    const signatures: Signature[] = algorandTransactionPlanner
        .plan(transaction)
        .filter(request => holds(request.signer))
        .map(request => ({
            requestIndex: request.requestIndex,
            signer: request.signer,
            scheme: request.scheme,
            bytes: signWith(request),
        }))
    const signed = await algorandTransactionPlanner.assemble(
        transaction,
        signatures,
    )
    return signed.bytes
}

// The local signer the live flows use, signing every transaction with `keys`.
const throughLocalSigner = async (
    transactions: Transaction[],
    keys: nacl.SignKeyPair,
): Promise<Uint8Array[]> => {
    const account = {
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: addressOf(keys), keyPairId: 'key' } },
    } as unknown as WalletAccount
    const signed = await signTransactionsWithLocalKey(
        {
            signPayloads: async (_keyPairId, payloads) =>
                payloads.map(p => nacl.sign.detached(p, keys.secretKey)),
            getPQSigningInfo: () => null,
        },
        transactions,
        transactions.map((_, i) => i),
        account,
    )
    return signed.map(encodeSignedTransaction)
}

describe('algorandTransactionPlanner', () => {
    describe('produces the bytes the live signers produce', () => {
        it('for a single transaction', async () => {
            const transaction = payment(addressOf(ALICE))

            expect(await throughPlanner(unsigned({ transaction }))).toEqual(
                (await throughLocalSigner([transaction], ALICE))[0],
            )
        })

        it('for a rekeyed sender, signed by its authority', async () => {
            const transaction = payment(addressOf(ALICE))
            const payload: AlgorandTransactionPayload = {
                transaction,
                authorizer: addressOf(BOB),
            }

            expect(await throughPlanner(unsigned(payload))).toEqual(
                (await throughLocalSigner([transaction], BOB))[0],
            )
        })

        it('for every member of an atomic group', async () => {
            const group = [1n, 2n, 3n].map(amount =>
                payment(addressOf(ALICE), amount),
            )
            assignGroupID(group)

            const planned = await Promise.all(
                group.map(transaction =>
                    throughPlanner(unsigned({ transaction })),
                ),
            )

            expect(planned).toEqual(await throughLocalSigner(group, ALICE))
        })

        it('for a multisig its participants sign, M of N', async () => {
            const multisig = {
                version: 1,
                threshold: 2,
                addresses: [ALICE, BOB, CAROL].map(addressOf),
            }
            const msig = generateMultisigAddress(1, 2, multisig.addresses)
            const transaction = payment(msig)
            const holdsAliceAndBob = (signer: string) =>
                signer !== addressOf(CAROL)
            const sign = (keys: nacl.SignKeyPair) => ({
                address: addressOf(keys),
                response: 'signed' as const,
                signatures: [
                    encodeToBase64(
                        nacl.sign.detached(
                            transaction.bytesToSign(),
                            keys.secretKey,
                        ),
                    ),
                ],
            })
            const assembled = await assembleSignedMultisigTransactions({
                rawTransactionsBase64: [
                    encodeToBase64(encodeTransactionRaw(transaction)),
                ],
                participantAddresses: multisig.addresses,
                version: 1,
                threshold: 2,
                responses: [sign(ALICE), sign(BOB)],
                multisigAddress: msig,
            })

            expect(assembled.kind).toBe('success')
            expect(
                await throughPlanner(
                    unsigned({ transaction, multisig }),
                    holdsAliceAndBob,
                ),
            ).toEqual(
                assembled.kind === 'success' &&
                    assembled.signedTransactionsBytes[0],
            )
        })
    })

    it('for a sender rekeyed to a multisig, with the multisig in sgnr', async () => {
        const addresses = [ALICE, BOB, CAROL].map(addressOf)
        const msig = generateMultisigAddress(1, 2, addresses)
        const transaction = payment(addressOf(ALICE))
        const signature = (keys: nacl.SignKeyPair) => ({
            address: addressOf(keys),
            response: 'signed' as const,
            signatures: [
                encodeToBase64(
                    nacl.sign.detached(
                        transaction.bytesToSign(),
                        keys.secretKey,
                    ),
                ),
            ],
        })
        const assembled = await assembleSignedMultisigTransactions({
            rawTransactionsBase64: [
                encodeToBase64(encodeTransactionRaw(transaction)),
            ],
            participantAddresses: addresses,
            version: 1,
            threshold: 2,
            responses: [signature(ALICE), signature(BOB)],
            multisigAddress: msig,
        })

        expect(
            await throughPlanner(
                unsigned({
                    transaction,
                    authorizer: msig,
                    multisig: { version: 1, threshold: 2, addresses },
                }),
                signer => signer !== addressOf(CAROL),
            ),
        ).toEqual(
            assembled.kind === 'success' &&
                assembled.signedTransactionsBytes[0],
        )
    })

    it('signs as the sender when the authority named is the sender', async () => {
        const transaction = payment(addressOf(ALICE))

        expect(
            await throughPlanner(
                unsigned({ transaction, authorizer: addressOf(ALICE) }),
            ),
        ).toEqual((await throughLocalSigner([transaction], ALICE))[0])
    })

    it.each([
        ['a threshold above the participants', { version: 1, threshold: 3 }],
        ['a zero threshold', { version: 1, threshold: 0 }],
        ['a fractional version', { version: 1.5, threshold: 1 }],
    ])('refuses multisig parameters with %s', (_case, parameters) => {
        const addresses = [ALICE, BOB].map(addressOf)

        expect(() =>
            algorandTransactionPlanner.plan(
                unsigned({
                    transaction: payment(addressOf(ALICE)),
                    multisig: { ...parameters, addresses },
                }),
            ),
        ).toThrow('malformed')
    })

    it("refuses an authority that isn't an Algorand address", () => {
        expect(() =>
            algorandTransactionPlanner.plan(
                unsigned({
                    transaction: payment(addressOf(ALICE)),
                    authorizer: 'not-an-address',
                }),
            ),
        ).toThrow('malformed')
    })

    it("refuses multisig signatures that don't match their planned participant", async () => {
        const addresses = [ALICE, BOB, CAROL].map(addressOf)
        const transaction = unsigned({
            transaction: payment(generateMultisigAddress(1, 2, addresses)),
            multisig: { version: 1, threshold: 2, addresses },
        })
        const [first, second] = algorandTransactionPlanner.plan(transaction)
        const signed = (request: SigningRequest): Signature => ({
            requestIndex: request.requestIndex,
            signer: request.signer,
            scheme: request.scheme,
            bytes: signWith(request),
        })

        await expect(
            Promise.resolve().then(() =>
                algorandTransactionPlanner.assemble(transaction, [
                    { ...signed(first), requestIndex: 1 },
                    signed(second),
                ]),
            ),
        ).rejects.toThrow('one per planned participant')
    })

    it('plans one request per multisig participant over the same bytes', () => {
        const addresses = [ALICE, BOB, CAROL].map(addressOf)
        const transaction = payment(generateMultisigAddress(1, 2, addresses))

        const requests = algorandTransactionPlanner.plan(
            unsigned({
                transaction,
                multisig: { version: 1, threshold: 2, addresses },
            }),
        )

        expect(requests.map(r => r.signer)).toEqual(addresses)
        expect(new Set(requests.map(r => encodeToBase64(r.payload)))).toEqual(
            new Set([encodeToBase64(transaction.bytesToSign())]),
        )
    })

    it("gives a device the transaction without the signing-domain prefix, as each request's own copy", () => {
        const addresses = [ALICE, BOB].map(addressOf)
        const transaction = payment(generateMultisigAddress(1, 2, addresses))

        const requests = algorandTransactionPlanner.plan(
            unsigned({
                transaction,
                multisig: { version: 1, threshold: 2, addresses },
            }),
        )

        for (const request of requests) {
            expect(request.devicePayload).toEqual(
                encodeTransactionRaw(transaction),
            )
            expect(
                new TextDecoder().decode(request.devicePayload?.slice(0, 2)),
            ).not.toBe('TX')
        }
        expect(requests[0].devicePayload?.buffer).not.toBe(
            requests[1].devicePayload?.buffer,
        )
    })

    it("refuses a multisig that doesn't derive to the address that signs", () => {
        const transaction = payment(addressOf(ALICE))

        expect(() =>
            algorandTransactionPlanner.plan(
                unsigned({
                    transaction,
                    multisig: {
                        version: 1,
                        threshold: 1,
                        addresses: [addressOf(BOB)],
                    },
                }),
            ),
        ).toThrow('does not derive')
    })

    it('refuses to assemble a multisig below its threshold', async () => {
        const addresses = [ALICE, BOB, CAROL].map(addressOf)
        const transaction = payment(generateMultisigAddress(1, 2, addresses))

        await expect(
            throughPlanner(
                unsigned({
                    transaction,
                    multisig: { version: 1, threshold: 2, addresses },
                }),
                signer => signer === addressOf(ALICE),
            ),
        ).rejects.toThrow('needs 2 signatures, not 1')
    })

    it("refuses a transaction for another network than the scope's", () => {
        const testnetTransaction = makeTestPaymentTx(
            Address.fromString(addressOf(ALICE)),
            { receiver: Address.fromString(addressOf(BOB)) },
        )

        expect(() =>
            algorandTransactionPlanner.plan(
                unsigned({ transaction: testnetTransaction }),
            ),
        ).toThrow()
    })
})

transactionPlannerContractTests(() => algorandTransactionPlanner, {
    transaction: unsigned({ transaction: payment(addressOf(ALICE)) }),
    otherTransaction: unsigned({ transaction: payment(addressOf(ALICE), 6n) }),
    malformedTransaction: unsigned({ authorizer: addressOf(BOB) }),
    sign: async request => signWith(request),
    stranger: addressOf(CAROL),
})
