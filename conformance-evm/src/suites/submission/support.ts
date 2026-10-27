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
    hexToBytes,
    parseTransaction,
    type Address,
    type FeeValuesEIP1559,
    type Hex,
    type PublicClient,
    type TransactionSerializedEIP1559,
} from 'viem'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { buildEthereumSendTransaction } from '@perawallet/wallet-core-chain-ethereum/connect/sendTransaction'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import { buildEvmReplacement } from '@perawallet/wallet-core-chain-ethereum/transfer/replacement'
import {
    historyEntryOfSigned,
    submitAndRecordEthereumTransactions,
} from '@perawallet/wallet-core-chain-ethereum/transfer/submission'
import {
    getSubmissionAttemptsAtNonce,
    type SubmissionAttempt,
} from '@perawallet/wallet-core-signing'

import type { EvmConformanceAccount } from '../../harness/accounts'
import { castCalldata } from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import type { EvmConformanceEnv } from '../../harness/context'
import {
    anvilRpc,
    withAutomineOff,
    type EvmnetChain,
} from '../../harness/evmnet'
import { signTransactionWithApp } from '../../harness/sign'
import { buildTransfer } from '../construction/support'

export const appClient = (env: EvmConformanceEnv): PublicClient =>
    createEvmClient(env.scope, env.ctx, env.evmChain)

/**
 * Automine off for `fn`. A failing assertion drops whatever it pooled before
 * rethrowing, so the failure is reported here rather than as a dirty pool
 * that later files trip over.
 */
export const withPendingPool = <T>(
    chain: EvmnetChain,
    fn: () => Promise<T>,
): Promise<T> =>
    withAutomineOff(chain, async () => {
        try {
            return await fn()
        } catch (error) {
            await anvilRpc(chain, 'anvil_dropAllTransactions')
            throw error
        }
    })

type TxpoolContent = Record<
    'pending' | 'queued',
    Record<string, Record<string, { hash: Hex }>>
>

/** Every hash the node pools, lower-cased, read from the node's own txpool. */
export const pooledHashes = async (chain: EvmnetChain): Promise<string[]> => {
    const content = await anvilRpc<TxpoolContent>(chain, 'txpool_content')
    return [content.pending, content.queued]
        .flatMap(bySender => Object.values(bySender))
        .flatMap(byNonce => Object.values(byNonce))
        .map(tx => tx.hash.toLowerCase())
}

export const transactionOf = (raw: Hex) =>
    parseTransaction(raw as TransactionSerializedEIP1559)

export const feesOf = (raw: Hex): FeeValuesEIP1559 => {
    const { maxFeePerGas, maxPriorityFeePerGas } = transactionOf(raw)
    return {
        maxFeePerGas: maxFeePerGas!,
        maxPriorityFeePerGas: maxPriorityFeePerGas!,
    }
}

const withFees = (
    unsigned: UnsignedTransaction,
    fees: FeeValuesEIP1559,
): UnsignedTransaction => {
    const payload = unsigned.payload as EthereumTransactionPayload
    return {
        ...unsigned,
        payload: {
            ...payload,
            transaction: { ...payload.transaction, ...fees },
        },
    }
}

/**
 * The app's native transfer, signed by the app. `fees` overrides the
 * preset prices, for a test that needs exact numbers to bump against.
 */
export const signedTransfer = async (
    env: EvmConformanceEnv,
    sender: EvmConformanceAccount,
    to: Address,
    wei: bigint,
    fees?: FeeValuesEIP1559,
): Promise<{ raw: Hex; unsigned: UnsignedTransaction }> => {
    const built = await buildTransfer(env, {
        from: sender.address,
        to,
        assetRef: env.evmChain.descriptor.nativeAsset.ref,
        amount: wei,
    })
    const unsigned = fees ? withFees(built.unsigned, fees) : built.unsigned
    return {
        raw: await signTransactionWithApp(env, sender, unsigned),
        unsigned,
    }
}

/** The app's speed-up or cancel of `raw`, signed by the app; `fees` overrides its pricing. */
export const signedReplacement = async (
    env: EvmConformanceEnv,
    sender: EvmConformanceAccount,
    kind: 'speed-up' | 'cancel',
    raw: Hex,
    fees?: FeeValuesEIP1559,
): Promise<{ raw: Hex; unsigned: UnsignedTransaction }> => {
    const [built] = await buildEvmReplacement(
        env.ctx,
        env.evmChain,
        { kind, rawTransaction: raw },
        { scope: env.scope },
    )
    const unsigned = fees ? withFees(built, fees) : built
    return {
        raw: await signTransactionWithApp(env, sender, unsigned),
        unsigned,
    }
}

// Explicit, so estimation can't refuse the call before the node mines its revert.
export const REVERTING_CALL_GAS = 100_000n

/** The app builds and signs a call to `Reverter.revertBare()`, as for a dApp's request. */
export const signedRevertingCall = async (
    env: EvmConformanceEnv,
    sender: EvmConformanceAccount,
): Promise<Hex> => {
    const reverter = await deployContract(env.chain, 'Reverter')
    const unsigned = await buildEthereumSendTransaction(env.ctx, env.evmChain, {
        from: sender.address,
        to: reverter,
        value: 0n,
        data: await castCalldata('revertBare()'),
        gas: REVERTING_CALL_GAS,
    })
    return signTransactionWithApp(env, sender, unsigned)
}

/** Records and broadcasts as the app's transport does, into the session's ledger. */
export const submitAndRecord = async (
    env: EvmConformanceEnv,
    raw: Hex,
): Promise<Hex> => {
    const [hash] = await submitAndRecordEthereumTransactions({
        client: appClient(env),
        chain: env.evmChain,
        scope: env.scope,
        signedTransactions: [hexToBytes(raw)],
        flow: 'pipeline',
        historyEntries: [
            await historyEntryOfSigned(
                raw as TransactionSerializedEIP1559,
                env.evmChain,
            ),
        ],
        db: env.db,
    })
    return hash as Hex
}

/** Every ledger row of `sender` at `nonce`, any status, oldest first. */
export const rowsAtNonce = (
    env: EvmConformanceEnv,
    sender: Address,
    nonce: number,
): Promise<SubmissionAttempt[]> =>
    getSubmissionAttemptsAtNonce({
        db: env.db,
        scope: env.scope,
        sender,
        nonce,
    })

/** The node's own receipt JSON, null while it has none. */
export const nodeReceipt = (
    chain: EvmnetChain,
    hash: Hex,
): Promise<{ status: Hex; gasUsed: Hex; effectiveGasPrice: Hex } | null> =>
    anvilRpc(chain, 'eth_getTransactionReceipt', [hash])

/**
 * The receipt of a send under automine. Anvil can answer
 * `eth_sendRawTransaction` before the block holding it is sealed.
 */
export const minedReceipt = async (
    chain: EvmnetChain,
    hash: Hex,
): Promise<{ status: Hex; gasUsed: Hex; effectiveGasPrice: Hex }> => {
    for (let attempt = 0; attempt < 50; attempt++) {
        const receipt = await nodeReceipt(chain, hash)
        if (receipt) return receipt
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`${hash} was not mined on ${chain} within 5 s`)
}

export const nodeTransaction = (
    chain: EvmnetChain,
    hash: Hex,
): Promise<{ hash: Hex } | null> =>
    anvilRpc(chain, 'eth_getTransactionByHash', [hash])

/** Wei the node charged for `hash`: gas used times the effective price. */
export const chargedFee = async (
    chain: EvmnetChain,
    hash: Hex,
): Promise<bigint> => {
    const receipt = await nodeReceipt(chain, hash)
    if (!receipt) throw new Error(`the node has no receipt for ${hash}`)
    return BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)
}
