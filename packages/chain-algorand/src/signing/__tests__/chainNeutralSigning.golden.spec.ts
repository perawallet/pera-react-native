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
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type {
    AnalyzedSignableGroup,
    LocalKeySigningDeps,
    SignerInfo,
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
import {
    assembleSignedTransaction,
    signTransactionsWithLocalKey,
} from '../local-key/signTransactionsWithLocalKey'
import { buildDeferredProposeSigningResult } from '../multisig/multisigParticipants'
import { signUnsignedTransactionsWithLocalKey } from '../signedTransactions'
import {
    asUnsignedAlgorandTransaction,
    MAINNET_GENESIS_HASH,
    makeTestPaymentTx,
} from './transactions'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '../../blockchain/models/algosdk-shapes'

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
    signTransactions: (transactions, indexesToSign, account) =>
        signUnsignedTransactionsWithLocalKey(
            deps,
            transactions,
            indexesToSign,
            account,
        ),
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

const neutralGroup = (
    transactions: PeraTransaction[],
    indicesToSign: number[],
    source: SourceMetadata = { type: 'local' },
): AnalyzedSignableGroup => ({
    source,
    signerAddress: transactions[0].sender.toString(),
    originalIndices: transactions.map((_, i) => i),
    analysis,
    data: {
        type: 'transactions',
        transactions: transactions.map(txn =>
            asUnsignedAlgorandTransaction(txn),
        ),
        chainData: { algorand: { indicesToSign } },
    },
})

const signedOf = (result: SigningResult): SignedTransaction[] => {
    if (result.signedData.type !== 'transactions') {
        throw new Error(`unexpected ${result.signedData.type}`)
    }
    return result.signedData.signed
}

const signedBytes = (result: SigningResult): Uint8Array[] =>
    signedOf(result).map(signed => signed.bytes)

// The reference is the Algorand transactions signed directly by the local-key
// signer, with no chain-neutral wrapping in between.
const signBoth = async (
    transactions: PeraTransaction[],
    indicesToSign: number[],
    account: WalletAccount,
    source?: SourceMetadata,
) => {
    const expected = await signTransactionsWithLocalKey(
        deps,
        transactions,
        indicesToSign,
        account,
    )
    const result = await strategy.sign(
        neutralGroup(transactions, indicesToSign, source),
        account,
    )
    return { expected, result }
}

const signersOf = (
    address: string,
    signed: PeraSignedTransaction[],
): SignerInfo[] => [
    {
        address,
        signatures: signed.map(stx =>
            stx.sig ? encodeToBase64(stx.sig) : null,
        ),
    },
]

describe('a chain-neutral Algorand group signs to the same bytes as its Algorand form', () => {
    it('for a single transaction', async () => {
        const { expected, result } = await signBoth(
            [payment(addressOf(ALICE), 1n)],
            [0],
            alice,
        )

        expect(signedBytes(result)).toEqual(
            expected.map(encodeSignedTransaction),
        )
        expect(result.signers).toEqual(
            signersOf(addressOf(ALICE).toString(), expected),
        )
    })

    it('for the signable members of an atomic group', async () => {
        const group = groupTransactions([
            payment(addressOf(ALICE), 1n),
            payment(addressOf(BOB), 2n),
            payment(addressOf(ALICE), 3n),
        ])

        const { expected, result } = await signBoth(group, [0, 2], alice)

        expect(signedBytes(result)).toEqual(
            expected.map(encodeSignedTransaction),
        )
    })

    it('for a rekeyed sender, signed by its authority', async () => {
        const { expected, result } = await signBoth(
            [payment(addressOf(BOB), 1n)],
            [0],
            alice,
        )

        expect(signedBytes(result)).toEqual(
            expected.map(encodeSignedTransaction),
        )
    })

    it('for a quantum key', async () => {
        const { expected, result } = await signBoth(
            [payment(addressOf(QUANTUM), 1n)],
            [0],
            quantum,
        )

        expect(signedBytes(result)).toEqual(
            expected.map(encodeSignedTransaction),
        )
        expect(expected[0].pqsig).toBeTruthy()
    })

    it('for a multisig cosignature, signed by the participant itself', async () => {
        const { expected, result } = await signBoth(
            [payment(addressOf(ALICE), 1n)],
            [0],
            bob,
            { type: 'multisig-cosign', signRequestId: 'sign-request-1' },
        )

        expect(signedBytes(result)).toEqual(
            expected.map(encodeSignedTransaction),
        )
        expect(result.signers).toEqual(
            signersOf(addressOf(BOB).toString(), expected),
        )
    })

    it('for a deferred multisig proposal, which carries the unsigned group', () => {
        const transactions = [
            payment(addressOf(ALICE), 1n),
            payment(addressOf(ALICE), 2n),
        ]

        expect(
            signedBytes(
                buildDeferredProposeSigningResult(
                    neutralGroup(transactions, [0, 1]),
                ),
            ),
        ).toEqual(
            transactions.map(txn =>
                encodeSignedTransaction(assembleSignedTransaction(txn)),
            ),
        )
    })
})
