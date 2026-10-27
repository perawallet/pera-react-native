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

import { bytesToHex, parseTransaction, recoverTransactionAddress } from 'viem'
import type {
    Hex,
    TransactionSerializable,
    TransactionSerializedEIP1559,
} from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { createEvmPlannerAdapter } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { ethereumCallSummary } from '@perawallet/wallet-core-chain-ethereum/signing/review'
import { SIGNING_KEY_DOMAIN } from '@perawallet/wallet-core-signing/constants'
import { signPlannedGroups } from '@perawallet/wallet-core-signing/machine/actors/signers/signPlannedGroups'
import { reviewGroup } from '@perawallet/wallet-core-signing/pipeline/composeAnalysis'
import { reviewerFor } from '@perawallet/wallet-core-signing/pipeline/transactionReviewerBridge'
import type {
    AnalyzedSignableGroup,
    SignableGroup,
} from '@perawallet/wallet-core-signing/pipeline/types'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    type EvmConformanceAccount,
} from '../../harness/accounts'
import { castMktx } from '../../harness/cast'
import {
    createEvmConformanceEnv,
    type EvmConformanceEnv,
} from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { broadcastAndConfirm, rejectionOf } from '../../harness/submit'

const CHAIN_ID = EVMNET.ethereum.eip155ChainId

const unsignedTransfer = (
    env: EvmConformanceEnv,
    from: EvmConformanceAccount,
    to: EvmConformanceAccount,
    transaction: TransactionSerializable = {
        type: 'eip1559',
        chainId: CHAIN_ID,
        nonce: 0,
        to: to.address,
        value: 1000n,
        gas: 21_000n,
        maxFeePerGas: 3_000_000_000n,
        maxPriorityFeePerGas: 1_000_000_000n,
    },
): UnsignedTransaction => ({
    scope: env.scope,
    payload: { from: from.address, transaction },
    summary: ethereumCallSummary(
        { from: from.address, to: to.address, value: 1000n, data: '0x' },
        env.evmChain,
    ),
    chainData: { family: 'evm' },
})

/** What the signing machine hands `signPlannedGroups`: the real review, over `reviewing`'s accounts. */
const analyze = async (
    env: EvmConformanceEnv,
    unsigned: UnsignedTransaction,
    presentedAs: EvmConformanceAccount,
    reviewing: WalletAccount[],
): Promise<AnalyzedSignableGroup> => {
    const group: SignableGroup = {
        data: { type: 'transactions', transactions: [unsigned] },
        source: { type: 'local' },
        signerAddress: presentedAs.address,
        originalIndices: [0],
    }
    const analysis = await reviewGroup(reviewerFor(env.scope.chainId), group, {
        scope: env.scope,
        accounts: reviewing,
    })
    return { ...group, analysis }
}

const spiedKeyStore = (env: EvmConformanceEnv) => {
    const sign = vi.fn(env.kms.sign)
    return { keyStore: { sign }, sign }
}

const signedBytesOf = async (
    env: EvmConformanceEnv,
    group: AnalyzedSignableGroup,
    allAccounts: WalletAccount[],
    keyStore: { sign: typeof env.kms.sign },
): Promise<Hex> => {
    const [result] = await signPlannedGroups({
        groups: [group],
        allAccounts,
        scope: env.scope,
        keyStore,
    })
    if (result?.signedData.type !== 'signed-transactions') {
        throw new Error('expected signed transactions')
    }
    return bytesToHex(result.signedData.signed[0].bytes)
}

/**
 * Proves a transaction is only ever signed by the key of the account that
 * sends it and that the user reviewed, and that only EIP-1559 payloads reach
 * a signature. Recovering the signer from the produced bytes, rather than
 * trusting the signer the app reports, is what a mock keystore can't do.
 */
describe('evm signer binding', () => {
    it('signs with the sender when the review lists it, and recovers the sender', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const a = await createRawKeyEvmAccount(env)
        const b = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, a.address, 10n ** 18n)
        const unsigned = unsignedTransfer(env, a, b)
        const group = await analyze(env, unsigned, a, [a.walletAccount])
        const { keyStore, sign } = spiedKeyStore(env)

        const raw = await signedBytesOf(env, group, [a.walletAccount], keyStore)

        expect(group.analysis.signableAddresses).toEqual([a.address])
        expect(
            await recoverTransactionAddress({
                serializedTransaction: raw as TransactionSerializedEIP1559,
            }),
        ).toBe(a.address)
        // Node acceptance: the node attributes the mined transaction to A too.
        const { receipt } = await broadcastAndConfirm(env, raw)
        expect(receipt.from.toLowerCase()).toBe(a.address.toLowerCase())
        expect(sign).toHaveBeenCalledTimes(1)
        expect(sign).toHaveBeenCalledWith(
            a.keyPairId,
            expect.any(Uint8Array),
            SIGNING_KEY_DOMAIN,
        )
    })

    it('produces no signature for an account the review does not list', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const a = await createRawKeyEvmAccount(env)
        const b = await createRawKeyEvmAccount(env)
        const unsigned = unsignedTransfer(env, a, b)
        const { keyStore, sign } = spiedKeyStore(env)

        // Neither an empty review nor one that lists only another account lets A sign.
        for (const signableAddresses of [[], [b.address]]) {
            const group = await analyze(env, unsigned, a, [a.walletAccount])
            const forged: AnalyzedSignableGroup = {
                ...group,
                analysis: { ...group.analysis, signableAddresses },
            }
            const error = await rejectionOf(() =>
                signedBytesOf(
                    env,
                    forged,
                    [a.walletAccount, b.walletAccount],
                    keyStore,
                ),
            )
            expect((error as Error).message).toBe(
                `Cannot sign with account ${a.address}: the wallet holds none of the keys this transaction needs`,
            )
        }
        expect(sign).not.toHaveBeenCalled()
    })

    it('does not sign with the wrong key when the transaction names another wallet account', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const a = await createRawKeyEvmAccount(env)
        const b = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, a.address, 10n ** 18n)
        const everyone = [a.walletAccount, b.walletAccount]
        // A's transaction, presented as B's to sign.
        const unsigned = unsignedTransfer(env, a, b)
        const { keyStore, sign } = spiedKeyStore(env)

        // The user approved B only: the review of a wallet holding just B lists
        // nothing, so nothing signs.
        const reviewedForB = await analyze(env, unsigned, b, [b.walletAccount])
        expect(reviewedForB.analysis.signableAddresses).toEqual([])
        const refusal = await rejectionOf(() =>
            signedBytesOf(env, reviewedForB, [b.walletAccount], keyStore),
        )
        expect((refusal as Error).message).toBe(
            `Cannot sign with account ${b.address}: the wallet holds none of the keys this transaction needs`,
        )
        expect(sign).not.toHaveBeenCalled()

        // A review that lists B alone, forged over A's transaction, still signs nothing.
        const group = await analyze(env, unsigned, b, everyone)
        const forgedForB: AnalyzedSignableGroup = {
            ...group,
            analysis: { ...group.analysis, signableAddresses: [b.address] },
        }
        await expect(
            signedBytesOf(env, forgedForB, everyone, keyStore),
        ).rejects.toThrow('the wallet holds none of the keys')
        expect(sign).not.toHaveBeenCalled()

        // With both accounts held and the real review, only A's key signs.
        expect(group.analysis.signableAddresses).toEqual([a.address])
        const raw = await signedBytesOf(env, group, everyone, keyStore)
        expect(
            await recoverTransactionAddress({
                serializedTransaction: raw as TransactionSerializedEIP1559,
            }),
        ).toBe(a.address)
        // Node acceptance: the node attributes the mined transaction to A too.
        const { receipt } = await broadcastAndConfirm(env, raw)
        expect(receipt.from.toLowerCase()).toBe(a.address.toLowerCase())
        expect(sign).toHaveBeenCalledTimes(1)
        expect(sign.mock.calls[0][0]).toBe(a.keyPairId)
        expect(sign.mock.calls[0][0]).not.toBe(b.keyPairId)
    })

    it('refuses to assemble a signature from a key other than the sender', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const a = await createRawKeyEvmAccount(env)
        const b = await createRawKeyEvmAccount(env)
        const planner = createEvmPlannerAdapter(env.evmChain)
        const unsigned = unsignedTransfer(env, a, b)
        const [request] = planner.plan(unsigned)
        const bytes = await env.kms.sign(
            b.keyPairId,
            request.payload,
            SIGNING_KEY_DOMAIN,
        )

        await expect(
            Promise.resolve(
                planner.assemble(unsigned, [
                    {
                        requestIndex: 0,
                        signer: b.address,
                        scheme: 'secp256k1',
                        bytes,
                    },
                ]),
            ),
        ).rejects.toThrow(
            'An EVM transaction takes exactly one secp256k1 signature, from its sender',
        )
    })

    it("refuses another key's signature labelled as the sender's", async () => {
        // Signers label a signature with the address they were asked for, not
        // the key that signed (a device can hold a different key than the one
        // checked at connect), so the label alone must not decide the sender.
        const env = await createEvmConformanceEnv('ethereum')
        const a = await createRawKeyEvmAccount(env)
        const b = await createRawKeyEvmAccount(env)
        const planner = createEvmPlannerAdapter(env.evmChain)
        const unsigned = unsignedTransfer(env, a, b)
        const [request] = planner.plan(unsigned)
        const bytes = await env.kms.sign(
            b.keyPairId,
            request.payload,
            SIGNING_KEY_DOMAIN,
        )

        const error = await rejectionOf(async () =>
            planner.assemble(unsigned, [
                {
                    requestIndex: 0,
                    signer: a.address,
                    scheme: 'secp256k1',
                    bytes,
                },
            ]),
        )
        expect((error as Error).message).toBe(
            `The signature recovers to ${b.address}, not the sender ${a.address}`,
        )
    })

    describe('payload types', () => {
        const refusal = 'The EVM transaction payload is malformed'

        it('refuses a legacy (type 0) payload at the planner, built by cast', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const a = await createRawKeyEvmAccount(env)
            const b = await createRawKeyEvmAccount(env)
            const legacy = parseTransaction(
                await castMktx({
                    privateKey: a.privateKey,
                    chainId: CHAIN_ID,
                    nonce: 0,
                    to: b.address,
                    value: 1000n,
                    gas: 21_000n,
                    maxFeePerGas: 3_000_000_000n,
                    legacy: true,
                }),
            )
            expect(legacy.type).toBe('legacy')
            const unsigned = unsignedTransfer(env, a, b, legacy)

            expect(() =>
                createEvmPlannerAdapter(env.evmChain).plan(unsigned),
            ).toThrow(refusal)
        })

        it('refuses an EIP-2930 payload at the planner', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const a = await createRawKeyEvmAccount(env)
            const b = await createRawKeyEvmAccount(env)
            const unsigned = unsignedTransfer(env, a, b, {
                type: 'eip2930',
                chainId: CHAIN_ID,
                nonce: 0,
                to: b.address,
                value: 1000n,
                gas: 21_000n,
                gasPrice: 3_000_000_000n,
                accessList: [],
            })

            expect(() =>
                createEvmPlannerAdapter(env.evmChain).plan(unsigned),
            ).toThrow(refusal)
        })

        it('signs neither a legacy nor an EIP-2930 payload through the whole pipeline', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const a = await createRawKeyEvmAccount(env)
            const b = await createRawKeyEvmAccount(env)
            const { keyStore, sign } = spiedKeyStore(env)
            const valid = await analyze(env, unsignedTransfer(env, a, b), a, [
                a.walletAccount,
            ])

            for (const transaction of [
                {
                    type: 'legacy',
                    chainId: CHAIN_ID,
                    nonce: 0,
                    to: b.address,
                    value: 1000n,
                    gas: 21_000n,
                    gasPrice: 3_000_000_000n,
                },
                {
                    type: 'eip2930',
                    chainId: CHAIN_ID,
                    nonce: 0,
                    to: b.address,
                    value: 1000n,
                    gas: 21_000n,
                    gasPrice: 3_000_000_000n,
                    accessList: [],
                },
            ] as const) {
                // The analysis is the valid one, so only the planner stands in the way.
                const group: AnalyzedSignableGroup = {
                    ...valid,
                    data: {
                        type: 'transactions',
                        transactions: [
                            unsignedTransfer(env, a, b, transaction),
                        ],
                    },
                }
                await expect(
                    signedBytesOf(env, group, [a.walletAccount], keyStore),
                ).rejects.toThrow(refusal)
            }
            expect(sign).not.toHaveBeenCalled()
        })

        it('refuses an untyped payload that carries only a gas price, before any key signs', async () => {
            const env = await createEvmConformanceEnv('ethereum')
            const a = await createRawKeyEvmAccount(env)
            const b = await createRawKeyEvmAccount(env)
            const untyped = unsignedTransfer(env, a, b, {
                chainId: CHAIN_ID,
                nonce: 0,
                to: b.address,
                value: 1000n,
                gas: 21_000n,
                gasPrice: 3_000_000_000n,
            })

            // Without the planner's check, viem would sign the missing fees as 0.
            const { keyStore, sign } = spiedKeyStore(env)
            const valid = await analyze(env, unsignedTransfer(env, a, b), a, [
                a.walletAccount,
            ])
            const group: AnalyzedSignableGroup = {
                ...valid,
                data: { type: 'transactions', transactions: [untyped] },
            }
            await expect(
                signedBytesOf(env, group, [a.walletAccount], keyStore),
            ).rejects.toThrow(
                'The EVM transaction needs a nonce, a gas limit and a max fee per gas to be signed',
            )
            expect(sign).not.toHaveBeenCalled()
        })
    })
})
