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
import {
    toBigInt,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import {
    parseEvmNftAssetId,
    type EvmNftStandard,
} from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import {
    encodeEvmNftTransfer,
    readEvmNftTransferAsset,
} from '../transfer/nft-transfer'
import { nftSendSubtitle, sendSummary } from '../transfer/summary'
import { readEvmReviewTransaction, readEvmTransaction } from './adapter'
import type { EvmStandardCall } from './standard-call-types'
import {
    approvalWarningOf,
    decodeEvmStandardCall,
    standardCallSummary,
} from './standard-calls'
import {
    readEthereumNative,
    toEthereumNative,
    type EthereumTransactionView,
} from './transaction-view'

const CONTRACT_CALL_TITLE_KEY = i18nKey('transactions.list_item.contract_call')

/** Explains a contract call from its calldata; undefined when it can't. */
export type CallRecogniser = (call: {
    to?: Address
    data: Hex
    value: bigint
}) => Optional<TransactionSummary>

const NO_RECOGNITION: CallRecogniser = () => undefined

const SELECTOR_SIZE = 4

/**
 * How far a batch call's max fee per gas may rise over the first call's, as
 * the review priced it, before it is refused rather than signed.
 */
export const BATCH_FEE_CEILING_MULTIPLIER = 2n

/**
 * The built call goes where the approved review showed it going, from the same
 * account, with the same value and calldata, and costs no more per gas than the
 * review allowed; only the nonce, gas and fees it gained may differ. What was
 * shown is the pipeline's own record of the review: a preview with its fee
 * ceiling, or the first call as it was priced then.
 */
const matchesPreview = (
    transaction: UnsignedTransaction,
    preview: UnsignedTransaction,
    chain: EvmChain,
): boolean => {
    try {
        if (toScopeKey(transaction.scope) !== toScopeKey(preview.scope)) {
            return false
        }
        const built = readEvmTransaction(transaction, chain)
        const shown = readEvmReviewTransaction(preview, chain)
        const [builtTo, shownTo] = [built.transaction.to, shown.transaction.to]
        const shownFee = shown.transaction.maxFeePerGas
        const ceilingOf = () => {
            if (shown.isPreview) return shown.maxFeePerGasCeiling
            if (shownFee === undefined) return undefined
            return shownFee * BATCH_FEE_CEILING_MULTIPLIER
        }
        const ceiling = ceilingOf()
        const builtFee = built.transaction.maxFeePerGas
        return (
            ceiling !== undefined &&
            builtFee !== undefined &&
            builtFee <= ceiling &&
            areEvmAddressesEqual(built.from, shown.from) &&
            typeof builtTo === 'string' &&
            typeof shownTo === 'string' &&
            areEvmAddressesEqual(builtTo, shownTo) &&
            (built.transaction.value ?? 0n) ===
                (shown.transaction.value ?? 0n) &&
            (built.transaction.data ?? '0x').toLowerCase() ===
                (shown.transaction.data ?? '0x').toLowerCase() &&
            (built.transaction.accessList ?? []).length === 0
        )
    } catch {
        return false
    }
}

// An allowlist, so a kind a future recogniser adds stays behind review until it opts in.
const AUTO_APPROVED_KINDS: ReadonlySet<TransactionSummary['kind']> = new Set([
    'transfer',
    'token-transfer',
    'nft-transfer',
])

const viewOfNative = (
    transaction: ReviewedTransaction,
): Optional<EthereumTransactionView> => {
    try {
        return readEthereumNative(transaction.native)
    } catch {
        return undefined
    }
}

// A dApp's call recognised from its calldata keeps a contract-call view, so
// recognition never lets it sign without review; a view that can't be read
// never does either.
const isAutoApproved = (transaction: ReviewedTransaction): boolean => {
    const kind = viewOfNative(transaction)?.kind
    return (
        AUTO_APPROVED_KINDS.has(transaction.summary.kind) &&
        kind !== undefined &&
        kind !== 'contract-call'
    )
}

// The wallet's own calls are explained by the proofs their summaries pass.
const isRecognising = (context: ReviewContext): boolean =>
    !context.isWalletBuilt

const recognisedCallOf = (
    transaction: ReviewedTransaction,
    context: ReviewContext,
): Optional<EvmStandardCall> =>
    isRecognising(context) ? viewOfNative(transaction)?.call : undefined

const UNKNOWN_CONTRACT_WARNING: ReviewWarning = {
    type: 'unknown-contract',
    severity: 'warning',
    message:
        "Pera can't tell what this contract call does. Only approve it if you trust the site.",
}

type Pricing = {
    nonce: number
    gas: bigint
    /** Wei. */
    maxFeePerGas: bigint
    /** Wei. */
    maxPriorityFeePerGas: bigint
}

type Call = {
    from: Address
    to?: Address
    /** Wei. */
    value: bigint
    data: Hex
    /** Absent on a batch preview, which is priced only once it is reached. */
    pricing?: Pricing
}

const toDecimal = (value: bigint): Decimal => new Decimal(value.toString())

// The fee shown is the most the signature authorises, so review needs a gas
// limit and a max fee, as signing does.
const readCall = (
    unsigned: UnsignedTransaction,
    chain: EvmChain,
    context?: ReviewContext,
): Call => {
    const { from, transaction, isPreview } = readEvmReviewTransaction(
        unsigned,
        chain,
    )
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
    if (
        !isPreview &&
        (typeof gas !== 'bigint' || typeof maxFeePerGas !== 'bigint')
    ) {
        throw new Error(
            'The EVM transaction needs a gas limit and a max fee per gas to be reviewed',
        )
    }
    if (
        typeof value !== 'bigint' ||
        !isHex(data) ||
        // viem left-pads odd hex when serialising, so the bytes shown would differ from those signed.
        data.length % 2 !== 0 ||
        (to != null && !isAddress(to)) ||
        (!isPreview &&
            (typeof maxPriorityFeePerGas !== 'bigint' ||
                typeof nonce !== 'number'))
    ) {
        throw new Error('The EVM transaction payload is malformed')
    }
    return {
        from,
        to: to == null ? undefined : getAddress(to),
        value,
        data,
        ...(!isPreview && {
            pricing: {
                nonce,
                gas: gas as bigint,
                maxFeePerGas: maxFeePerGas as bigint,
                maxPriorityFeePerGas,
            },
        }),
    }
}

const viewOf = (
    call: Call,
    kind: EthereumTransactionView['kind'],
    {
        token,
        nft,
        call: standard,
    }: Pick<EthereumTransactionView, 'token' | 'nft' | 'call'> = {},
): EthereumTransactionView => ({
    kind,
    from: call.from,
    ...(call.to && { to: call.to }),
    value: toDecimal(call.value),
    data: call.data,
    ...(size(call.data) >= SELECTOR_SIZE && {
        selector: slice(call.data, 0, SELECTOR_SIZE),
    }),
    ...(call.pricing
        ? {
              nonce: call.pricing.nonce,
              gas: call.pricing.gas,
              fee: {
                  maxFeePerGas: toDecimal(call.pricing.maxFeePerGas),
                  maxPriorityFeePerGas: toDecimal(
                      call.pricing.maxPriorityFeePerGas,
                  ),
                  maxFee: toDecimal(
                      call.pricing.gas * call.pricing.maxFeePerGas,
                  ),
              },
          }
        : { isPreview: true as const }),
    ...(token && { token }),
    ...(nft && { nft }),
    ...(standard && { call: standard }),
})

const contractCallView = (call: Call): EthereumTransactionView => {
    const standard = decodeEvmStandardCall(call)
    return viewOf(call, 'contract-call', standard && { call: standard })
}

const nativeAmount = (chain: EvmChain, value: bigint) => ({
    assetRef: chain.descriptor.nativeAsset.ref,
    value: toDecimal(value),
})

type CallFacts = Pick<Call, 'from' | 'to' | 'value' | 'data'>

const contractCallSummary = (
    call: CallFacts,
    chain: EvmChain,
): TransactionSummary => ({
    kind: 'contract-call',
    title: { key: CONTRACT_CALL_TITLE_KEY },
    direction: call.value > 0n ? 'out' : 'none',
    ...(call.to && { counterparty: call.to }),
    ...(call.value > 0n && { amount: nativeAmount(chain, call.value) }),
    icon: 'contract-call',
})

// A summary is the request's own claim, so only a token transfer the payload
// proves is honoured: re-encoding the claim with the same ERC-20 encoder the
// wallet builds with must give exactly the calldata. This decodes nothing, so
// it is no bundled-ABI recognition.
const verifiedTokenTransfer = (
    summary: Optional<TransactionSummary>,
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
        !areEvmAddressesEqual(call.to, amount.assetRef.assetId) ||
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

const NFT_STANDARDS: readonly EvmNftStandard[] = ['erc721', 'erc1155']

// The same proof as a token transfer, with `from` read from the payload: a
// claim naming another holder must not match. The standard is whichever
// encoding gives exactly the calldata; an ERC-721 only ever moves one.
const verifiedNftTransfer = (
    summary: Optional<TransactionSummary>,
    call: Call,
): EthereumTransactionView['nft'] => {
    if (summary?.kind !== 'nft-transfer' || !call.to || call.value !== 0n) {
        return undefined
    }
    const { amount, counterparty } = summary
    const nft =
        typeof amount?.assetRef?.assetId === 'string'
            ? parseEvmNftAssetId(amount.assetRef.assetId)
            : null
    if (
        !amount ||
        !nft ||
        !areEvmAddressesEqual(call.to, nft.contract) ||
        typeof counterparty !== 'string' ||
        !isAddress(counterparty) ||
        !Decimal.isDecimal(amount.value) ||
        !amount.value.isInteger() ||
        amount.value.lte(0) ||
        amount.value.greaterThan(maxUint256.toString())
    ) {
        return undefined
    }
    const to = getAddress(counterparty)
    const units = toBigInt(amount.value)
    const standard = NFT_STANDARDS.find(
        candidate =>
            (candidate !== 'erc721' || units === 1n) &&
            encodeEvmNftTransfer({
                standard: candidate,
                from: call.from,
                to,
                tokenId: nft.tokenId,
                amount: units,
            }).toLowerCase() === call.data.toLowerCase(),
    )
    if (!standard) return undefined
    return {
        assetId: amount.assetRef.assetId,
        contract: nft.contract,
        tokenId: nft.tokenId,
        standard,
        to,
        amount: toDecimal(units),
    }
}

/** The view a review screen reads, or null for a payload review would refuse. Never a verified token or NFT transfer: that needs the request's summary. */
export const ethereumViewOf = (
    unsigned: UnsignedTransaction,
    chain: EvmChain,
): Nullable<EthereumTransactionView> => {
    try {
        const call = readCall(unsigned, chain)
        return call.to && size(call.data) === 0
            ? viewOf(call, 'transfer')
            : contractCallView(call)
    } catch {
        return null
    }
}

/** A native transfer when there is a `to` and no calldata, else a contract call. */
export const ethereumCallSummary = (
    call: CallFacts,
    chain: EvmChain,
): TransactionSummary =>
    call.to && size(call.data) === 0
        ? sendSummary(
              'transfer',
              call.from,
              call.to,
              nativeAmount(chain, call.value),
          )
        : contractCallSummary(call, chain)

const reviewCall = async (
    chain: EvmChain,
    call: Call,
    unsigned: UnsignedTransaction,
    context: ReviewContext,
    recogniseCall: CallRecogniser,
): Promise<ReviewedTransaction> => {
    if (call.to && size(call.data) === 0) {
        return {
            summary: ethereumCallSummary(call, chain),
            native: toEthereumNative(viewOf(call, 'transfer')),
        }
    }
    const { summary } = unsigned
    const token = context.isWalletBuilt
        ? verifiedTokenTransfer(summary, call)
        : undefined
    if (token) {
        return {
            summary: sendSummary('token-transfer', call.from, token.to, {
                assetRef: {
                    chainId: chain.row.id,
                    assetId: token.contract,
                },
                value: token.amount,
            }),
            native: toEthereumNative(viewOf(call, 'token-transfer', { token })),
        }
    }
    const nft = context.isWalletBuilt
        ? verifiedNftTransfer(summary, call)
        : undefined
    if (nft) {
        // A label only: the bytes above already proved the contract and token
        // id, so a failed store read falls back to the contract, never fails review.
        const stored = await readEvmNftTransferAsset(
            unsigned.scope,
            nft.assetId,
        ).catch(() => null)
        return {
            summary: sendSummary(
                'nft-transfer',
                call.from,
                nft.to,
                {
                    assetRef: { chainId: chain.row.id, assetId: nft.assetId },
                    value: nft.amount,
                },
                nftSendSubtitle(
                    stored?.collectionName ?? nft.contract,
                    nft.tokenId,
                ),
            ),
            native: toEthereumNative(viewOf(call, 'nft-transfer', { nft })),
        }
    }
    const view = contractCallView(call)
    const native = toEthereumNative(view)
    if (view.call && isRecognising(context)) {
        return { summary: standardCallSummary(view.call, chain), native }
    }
    const recognised = context.capabilities.contractDecoding
        ? recogniseCall({ to: call.to, data: call.data, value: call.value })
        : undefined
    return {
        summary: recognised ?? ethereumCallSummary(call, chain),
        native,
    }
}

/**
 * Native transfers and the wallet's own token and NFT transfers are explained
 * by their proofs. A dApp's standard token transfers and approvals are read
 * from their calldata whatever the chain's capabilities; any other call is
 * unrecognised unless `recogniseCall` reads it, which it is asked only while
 * `contractDecoding` is on.
 */
export const createEthereumReviewer = ({
    chain,
    recogniseCall = NO_RECOGNITION,
}: {
    chain: EvmChain
    recogniseCall?: CallRecogniser
}): TransactionReviewer => ({
    chainId: chain.row.id,
    decoder: {
        decode: async (transactions, context): Promise<DecodedTransactions> => {
            const signable = new Set<string>()
            let totalFees = 0n
            const reviewed = await Promise.all(
                transactions.map(unsigned => {
                    const call = readCall(unsigned, chain, context)
                    // Decoding is for signing, and a preview is never signed.
                    if (!call.pricing) {
                        throw new Error('A batch preview is never signed')
                    }
                    const held = context.heldAddresses.find(address =>
                        areEvmAddressesEqual(address, call.from),
                    )
                    if (held !== undefined) {
                        signable.add(held)
                        totalFees +=
                            call.pricing.gas * call.pricing.maxFeePerGas
                    }
                    return reviewCall(
                        chain,
                        call,
                        unsigned,
                        context,
                        recogniseCall,
                    )
                }),
            )
            return {
                totalFees: toDecimal(totalFees),
                signableAddresses: [...signable],
                transactions: reviewed,
            }
        },
    },
    warnings: {
        detect: (_transactions, decoded, context) =>
            decoded.signableAddresses.length === 0
                ? []
                : decoded.transactions
                      .filter(t => !isAutoApproved(t))
                      .flatMap(t => {
                          const standard = recognisedCallOf(t, context)
                          if (!standard)
                              return [{ ...UNKNOWN_CONTRACT_WARNING }]
                          const warning = approvalWarningOf(standard)
                          return warning ? [warning] : []
                      }),
    },
    policy: {
        autoApproveLocal: review => review.transactions.every(isAutoApproved),
        matchesApprovedPreview: (transaction, preview) =>
            matchesPreview(transaction, preview, chain),
    },
})
