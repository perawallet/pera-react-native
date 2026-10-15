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

import { describe, expect, it } from 'vitest'
import nacl from 'tweetnacl'
import { Address } from 'algosdk'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import type {
    AnalyzedSignableGroup,
    LocalKeySigningDeps,
    SigningResult,
    SourceMetadata,
} from '@perawallet/wallet-core-signing'
import { groupTransactions } from '../../blockchain'
import { encodeSignedTransaction } from '../../blockchain/utils/transact'
import {
    quantumAccount,
    standaloneAccount,
} from '../../__tests__/algorandAccounts'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { createLocalKeyStrategy } from '../local-key/createLocalKeyStrategy'
import { signTransactionsWithLocalKey } from '../local-key/signTransactionsWithLocalKey'
import { buildDeferredProposeSigningResult } from '../multisig/multisigParticipants'
import {
    asUnsignedAlgorandTransaction,
    MAINNET_GENESIS_HASH,
    makeTestPaymentTx,
} from './transactions'

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const

const keyPairOf = (byte: number): nacl.SignKeyPair =>
    nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(byte))
const addressOf = (keys: nacl.SignKeyPair): Address =>
    new Address(keys.publicKey)

const ALICE = keyPairOf(1)
const BOB = keyPairOf(2)
const QUANTUM = keyPairOf(3)
const KEYS: Record<string, nacl.SignKeyPair> = {
    'key-alice': ALICE,
    'key-bob': BOB,
    'key-quantum': QUANTUM,
}

const alice = standaloneAccount(addressOf(ALICE).toString(), {
    keyPairId: 'key-alice',
})
const bob = standaloneAccount(addressOf(BOB).toString(), {
    keyPairId: 'key-bob',
})
const quantum = quantumAccount(addressOf(QUANTUM).toString(), {
    keyPairId: 'key-quantum',
})

// Deterministic for both key kinds, so equal inputs give equal bytes.
const deps: LocalKeySigningDeps = {
    signPayloads: async (keyPairId, payloads) =>
        payloads.map(payload =>
            nacl.sign.detached(payload, KEYS[keyPairId].secretKey),
        ),
    getPQSigningInfo: keyPairId =>
        keyPairId === 'key-quantum'
            ? {
                  schemeId: 'falcon1024',
                  publicKey: new Uint8Array(1793).fill(7),
              }
            : null,
    yieldBetweenBatches: async () => undefined,
}

const strategy = createLocalKeyStrategy({
    signTransactions: (txnGroup, indexesToSign, account) =>
        signTransactionsWithLocalKey(deps, txnGroup, indexesToSign, account),
    signArbitraryData: async () => [],
    signAuthData: async () => new Uint8Array(),
    scope: SCOPE,
})

const payment = (sender: Address, amount: bigint): PeraTransaction =>
    makeTestPaymentTx(sender, {
        receiver: addressOf(BOB),
        amount,
        genesisHash: MAINNET_GENESIS_HASH,
    })

const analysis = {
    totalFees: 0n,
    warnings: [],
    signableAddresses: [],
    riskLevel: 'low' as const,
}

type Shapes = {
    algorand: AnalyzedSignableGroup
    neutral: AnalyzedSignableGroup
}

const bothShapes = (
    transactions: PeraTransaction[],
    indicesToSign: number[],
    source: SourceMetadata = { type: 'local' },
): Shapes => {
    const common = {
        source,
        signerAddress: transactions[0].sender.toString(),
        originalIndices: transactions.map((_, i) => i),
        analysis,
    }
    return {
        algorand: {
            ...common,
            data: { type: 'transactions', transactions, indicesToSign },
        },
        neutral: {
            ...common,
            data: {
                type: 'transactions',
                transactions: transactions.map(txn =>
                    asUnsignedAlgorandTransaction(txn),
                ),
                chainData: { algorand: { indicesToSign } },
            },
        },
    }
}

const signedBytes = (result: SigningResult): Uint8Array[] => {
    if (result.signedData.type !== 'transactions') {
        throw new Error(`unexpected ${result.signedData.type}`)
    }
    return result.signedData.signed.map(encodeSignedTransaction)
}

const signBoth = async (
    { algorand, neutral }: Shapes,
    account: WalletAccount,
) => {
    const expected = await strategy.sign(algorand, account)
    const result = await strategy.sign(neutral, account)
    return { expected, result }
}

describe('a chain-neutral Algorand group signs to the same bytes as its Algorand form', () => {
    it('for a single transaction', async () => {
        const { expected, result } = await signBoth(
            bothShapes([payment(addressOf(ALICE), 1n)], [0]),
            alice,
        )

        expect(signedBytes(result)).toEqual(signedBytes(expected))
        expect(result.signers).toEqual(expected.signers)
    })

    it('for the signable members of an atomic group', async () => {
        const group = groupTransactions([
            payment(addressOf(ALICE), 1n),
            payment(addressOf(BOB), 2n),
            payment(addressOf(ALICE), 3n),
        ])

        const { expected, result } = await signBoth(
            bothShapes(group, [0, 2]),
            alice,
        )

        expect(signedBytes(result)).toEqual(signedBytes(expected))
    })

    it('for a rekeyed sender, signed by its authority', async () => {
        const { expected, result } = await signBoth(
            bothShapes([payment(addressOf(BOB), 1n)], [0]),
            alice,
        )

        expect(signedBytes(result)).toEqual(signedBytes(expected))
    })

    // The fixture's Falcon key isn't a real one the msgpack encoder accepts, so
    // the envelopes are compared field by field, signature bytes included.
    it('for a quantum key', async () => {
        const { expected, result } = await signBoth(
            bothShapes([payment(addressOf(QUANTUM), 1n)], [0]),
            quantum,
        )

        expect(result.signedData).toEqual(expected.signedData)
        expect(
            result.signedData.type === 'transactions' &&
                result.signedData.signed[0].pqsig,
        ).toBeTruthy()
    })

    it('for a multisig cosignature, signed by the participant itself', async () => {
        const { expected, result } = await signBoth(
            bothShapes([payment(addressOf(ALICE), 1n)], [0], {
                type: 'multisig-cosign',
                signRequestId: 'sign-request-1',
            }),
            bob,
        )

        expect(signedBytes(result)).toEqual(signedBytes(expected))
        expect(result.signers).toEqual(expected.signers)
    })

    it('for a deferred multisig proposal, which carries the unsigned group', () => {
        const { algorand, neutral } = bothShapes(
            [payment(addressOf(ALICE), 1n), payment(addressOf(ALICE), 2n)],
            [0, 1],
        )

        expect(signedBytes(buildDeferredProposeSigningResult(neutral))).toEqual(
            signedBytes(buildDeferredProposeSigningResult(algorand)),
        )
    })
})
