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

import { Decimal } from 'decimal.js'
import {
    encodeFunctionData,
    erc20Abi,
    getAddress,
    isAddress,
    isHex,
    maxUint256,
    size,
    slice,
} from 'viem'
import type { Address, Hex } from 'viem'
import {
    toScopeKey,
    type DecodedTransactions,
    type ReviewContext,
    type ReviewedTransaction,
    type ReviewWarning,
    type TransactionReviewer,
    type TransactionSummary,
    type UnsignedTransaction,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { toBigInt, type Nullable } from '@perawallet/wallet-core-shared'
import { ethereumAddressCodec } from '../accounts/address-codec'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'
import { sendSummary } from '../transfer/summary'
import { readEthereumTransaction } from './adapter'
import {
    toEthereumNative,
    type EthereumTransactionView,
} from './transaction-view'

const CONTRACT_CALL_TITLE_KEY = i18nKey('transactions.list_item.contract_call')

/** Explains a contract call from its calldata; undefined when it can't. */
export type CallRecogniser = (call: {
    to?: Address
    data: Hex
    value: bigint
}) => TransactionSummary | undefined

const NO_RECOGNITION: CallRecogniser = () => undefined

const SELECTOR_SIZE = 4

// An allowlist, so a kind a future recogniser adds stays behind review until it opts in.
const AUTO_APPROVED_KINDS: ReadonlySet<TransactionSummary['kind']> = new Set([
    'transfer',
    'token-transfer',
])

const isAutoApproved = (transaction: ReviewedTransaction): boolean =>
    AUTO_APPROVED_KINDS.has(transaction.summary.kind)

const UNKNOWN_CONTRACT_WARNING: ReviewWarning = {
    type: 'unknown-contract',
    severity: 'warning',
    message:
        "Pera can't tell what this contract call does. Only approve it if you trust the site.",
}

type Call = {
    from: Address
    to?: Address
    /** Wei. */
    value: bigint
    data: Hex
    nonce: number
    gas: bigint
    /** Wei. */
    maxFeePerGas: bigint
    /** Wei. */
    maxPriorityFeePerGas: bigint
}

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

// Stricter than the planner, which signs without a gas limit or max fee: the
// fee shown is the most the signature authorises, so review needs both.
const readCall = (
    unsigned: UnsignedTransaction,
    context?: ReviewContext,
): Call => {
    const { from, transaction } = readEthereumTransaction(unsigned)
    if (context && toScopeKey(unsigned.scope) !== toScopeKey(context.scope)) {
        throw new Error(
            `The transaction is for ${toScopeKey(unsigned.scope)}, not ${toScopeKey(context.scope)}`,
        )
    }
    const {
        to,
        value = 0n,
        data = '0x',
        nonce = 0,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas = 0n,
    } = transaction
    if (typeof gas !== 'bigint' || typeof maxFeePerGas !== 'bigint') {
        throw new Error(
            'The Ethereum transaction needs a gas limit and a max fee per gas to be reviewed',
        )
    }
    if (
        typeof value !== 'bigint' ||
        typeof maxPriorityFeePerGas !== 'bigint' ||
        typeof nonce !== 'number' ||
        !isHex(data) ||
        // viem left-pads odd hex when serialising, so the bytes shown would differ from those signed.
        data.length % 2 !== 0 ||
        (to != null && !isAddress(to))
    ) {
        throw new Error('The Ethereum transaction payload is malformed')
    }
    return {
        from,
        to: to == null ? undefined : getAddress(to),
        value,
        data,
        nonce,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
    }
}

const viewOf = (
    call: Call,
    kind: EthereumTransactionView['kind'],
    token?: EthereumTransactionView['token'],
): EthereumTransactionView => ({
    kind,
    from: call.from,
    ...(call.to && { to: call.to }),
    value: toDecimal(call.value),
    data: call.data,
    ...(size(call.data) >= SELECTOR_SIZE && {
        selector: slice(call.data, 0, SELECTOR_SIZE),
    }),
    nonce: call.nonce,
    gas: call.gas,
    fee: {
        maxFeePerGas: toDecimal(call.maxFeePerGas),
        maxPriorityFeePerGas: toDecimal(call.maxPriorityFeePerGas),
        maxFee: toDecimal(call.gas * call.maxFeePerGas),
    },
    ...(token && { token }),
})

const nativeAmount = (value: bigint) => ({
    assetRef: ethereumDescriptor.nativeAsset.ref,
    value: toDecimal(value),
})

type CallFacts = Pick<Call, 'from' | 'to' | 'value' | 'data'>

const contractCallSummary = (call: CallFacts): TransactionSummary => ({
    kind: 'contract-call',
    title: { key: CONTRACT_CALL_TITLE_KEY },
    direction: call.value > 0n ? 'out' : 'none',
    ...(call.to && { counterparty: call.to }),
    ...(call.value > 0n && { amount: nativeAmount(call.value) }),
    icon: 'contract-call',
})

// A summary is the request's own claim, so only a token transfer the payload
// proves is honoured: re-encoding the claim with the same ERC-20 encoder the
// wallet builds with must give exactly the calldata. This decodes nothing, so
// it is no bundled-ABI recognition and `contractDecoding` doesn't gate it.
const verifiedTokenTransfer = (
    summary: TransactionSummary | undefined,
    call: Call,
): EthereumTransactionView['token'] => {
    if (summary?.kind !== 'token-transfer' || !call.to || call.value !== 0n) {
        return undefined
    }
    const { amount, counterparty } = summary
    if (
        !amount ||
        typeof amount.assetRef?.assetId !== 'string' ||
        !isAddress(amount.assetRef.assetId) ||
        !ethereumAddressCodec.areEqual(call.to, amount.assetRef.assetId) ||
        typeof counterparty !== 'string' ||
        !isAddress(counterparty) ||
        !Decimal.isDecimal(amount.value) ||
        !amount.value.isInteger() ||
        amount.value.isNegative() ||
        amount.value.greaterThan(maxUint256.toString())
    ) {
        return undefined
    }
    const to = getAddress(counterparty)
    const units = toBigInt(amount.value)
    const expected = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, units],
    })
    if (expected.toLowerCase() !== call.data.toLowerCase()) return undefined
    return { contract: call.to, to, amount: toDecimal(units) }
}

/** The view a review screen reads, or null for a payload review would refuse. Never a verified token transfer: that needs the request's summary. */
export const ethereumViewOf = (
    unsigned: UnsignedTransaction,
): Nullable<EthereumTransactionView> => {
    try {
        const call = readCall(unsigned)
        return viewOf(
            call,
            call.to && size(call.data) === 0 ? 'transfer' : 'contract-call',
        )
    } catch {
        return null
    }
}

/** A native transfer when there is a `to` and no calldata, else a contract call. */
export const ethereumCallSummary = (call: CallFacts): TransactionSummary =>
    call.to && size(call.data) === 0
        ? sendSummary('transfer', call.from, call.to, nativeAmount(call.value))
        : contractCallSummary(call)

const reviewCall = (
    call: Call,
    summary: TransactionSummary | undefined,
    context: ReviewContext,
    recogniseCall: CallRecogniser,
): ReviewedTransaction => {
    if (call.to && size(call.data) === 0) {
        return {
            summary: ethereumCallSummary(call),
            native: toEthereumNative(viewOf(call, 'transfer')),
        }
    }
    const token = context.isWalletBuilt
        ? verifiedTokenTransfer(summary, call)
        : undefined
    if (token) {
        return {
            summary: sendSummary('token-transfer', call.from, token.to, {
                assetRef: {
                    chainId: ETHEREUM_CHAIN_ID,
                    assetId: token.contract,
                },
                value: token.amount,
            }),
            native: toEthereumNative(viewOf(call, 'token-transfer', token)),
        }
    }
    const recognised = context.capabilities.contractDecoding
        ? recogniseCall({ to: call.to, data: call.data, value: call.value })
        : undefined
    return {
        summary: recognised ?? ethereumCallSummary(call),
        native: toEthereumNative(viewOf(call, 'contract-call')),
    }
}

/**
 * Native transfers and the wallet's own token transfers are explained; every
 * other call is unrecognised unless `recogniseCall` reads it, which it is
 * asked only while `contractDecoding` is on.
 */
export const createEthereumReviewer = ({
    recogniseCall = NO_RECOGNITION,
}: { recogniseCall?: CallRecogniser } = {}): TransactionReviewer => ({
    chainId: ETHEREUM_CHAIN_ID,
    decoder: {
        decode: async (transactions, context): Promise<DecodedTransactions> => {
            const signable = new Set<string>()
            let totalFees = 0n
            const reviewed = transactions.map(unsigned => {
                const call = readCall(unsigned, context)
                const held = context.heldAddresses.find(address =>
                    ethereumAddressCodec.areEqual(address, call.from),
                )
                if (held !== undefined) {
                    signable.add(held)
                    totalFees += call.gas * call.maxFeePerGas
                }
                return reviewCall(
                    call,
                    unsigned.summary,
                    context,
                    recogniseCall,
                )
            })
            return {
                totalFees: toDecimal(totalFees),
                signableAddresses: [...signable],
                transactions: reviewed,
            }
        },
    },
    warnings: {
        detect: (_transactions, decoded) =>
            decoded.signableAddresses.length === 0
                ? []
                : decoded.transactions
                      .filter(t => !isAutoApproved(t))
                      .map(() => ({ ...UNKNOWN_CONTRACT_WARNING })),
    },
    policy: {
        autoApproveLocal: review => review.transactions.every(isAutoApproved),
    },
})

export const ethereumReviewerAdapter = createEthereumReviewer()
