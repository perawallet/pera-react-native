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

import { getAddress } from 'viem'
import type { Address, Hex, PublicClient } from 'viem'
import type {
    ChainContext,
    ChainScope,
    SignedTransaction,
    TransactionSummary,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    generateOrderedUniqueId,
    logger,
    toBigInt,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    getOpenSubmissionAttempts,
    STALE_OPEN_ATTEMPT_MS,
    SubmissionError,
    UserRejectedSigningError,
    type SubmissionAttempt,
    type TransactionSignRequest,
    type UnsignedTransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import {
    isQuoteFresh,
    isSwapQuoteGoneError,
    signableStepsOn,
    type ExecuteSwapParams,
    type ExecuteSwapResult,
    type ReportSwapOrderFn,
    type SwapExecutionContext,
    type SwapExecutionFailure,
    type SwapOrder,
    type SwapReportedTransaction,
    type SwapSignTransactionsStep,
} from '@perawallet/wallet-core-swaps'
import { EvmErrorCode, evmErrorCodeOf, toEvmError } from '../blockchain/errors'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import type { EthereumTransactionPayload } from '../signing/adapter'
import { decodeEvmStandardCall } from '../signing/standard-calls'
import type { EvmTransferCall } from '../transfer/builder'
import { readTransferGasAndPresets } from '../transfer/fees'
import { allocateEthereumNonce } from '../transfer/nonce-pool'
import {
    ETHEREUM_CONFIRMATION_TIMEOUT_MS,
    SubmissionLedgerUnreadableError,
    submitAndRecordEthereumTransactions,
    waitForEvmReceipt,
} from '../transfer/submission'
import { spendApprovalSummary, swapSummary } from '../transfer/summary'
import {
    decodeSwapTransaction,
    type EvmSwapCall,
} from './decode-swap-transaction'
import {
    estimateEvmSwapSourceCost,
    evmShortfallOf,
    readEvmAllowance,
} from './source-cost'
import {
    validateEvmSwapTransactions,
    type EvmSwapPlan,
} from './validate-swap-transactions'

// The router's label for the allowance transaction it prepares in a swap step.
const APPROVAL_PURPOSE = 'approval'

const failed = (failure: SwapExecutionFailure): ExecuteSwapResult => ({
    kind: 'failed',
    failure,
})

const isUserRejection = (error: unknown): boolean =>
    error instanceof UserRejectedSigningError ||
    (error instanceof Error && error.name === 'LedgerUserRejectedError')

const reportCancelled = async (
    reportOrder: ReportSwapOrderFn,
    orderId: string,
): Promise<void> => {
    try {
        await reportOrder({ orderId, report: { status: 'cancelled' } })
    } catch {
        logger.warn('Failed to report swap cancellation to backend')
    }
}

// A `confirming` row is mined and only awaits finality, which would hold every
// next swap for minutes; only a row with no known outcome can still land.
const isUndecided = ({ status }: SubmissionAttempt): boolean =>
    status === 'submitted' || status === 'unknown'

const hasUndecidedAttempt = async (
    scope: ChainScope,
    sender: Address,
): Promise<boolean> => {
    try {
        const attempts = await getOpenSubmissionAttempts({
            scope,
            sender,
            flows: ['swap', 'cosign'],
            unevaluatableBefore: Date.now() - STALE_OPEN_ATTEMPT_MS,
        })
        return attempts.some(isUndecided)
    } catch (error) {
        // Failing open would let a rebuild broadcast unguarded.
        logger.warn('swap: rebuild guard lookup failed, refusing', { error })
        return true
    }
}

const toPlan = (
    steps: readonly SwapSignTransactionsStep[],
    { quote }: ExecuteSwapParams,
    { scope }: SwapExecutionContext,
    chain: EvmChain,
    routeContracts: readonly Address[],
): EvmSwapPlan =>
    validateEvmSwapTransactions({
        calls: steps
            .flatMap(step => step.transactions)
            .map(decodeSwapTransaction),
        request: quote.request,
        scope,
        chain,
        routeContracts,
    })

const requestSignature = (
    addSignRequest: (request: TransactionSignRequest) => void,
    source: ExecuteSwapParams['signingSource'],
    unsigned: UnsignedTransaction,
): Promise<SignedTransaction> =>
    new Promise((resolve, reject) => {
        const request: UnsignedTransactionSignRequest = {
            id: generateOrderedUniqueId(),
            type: 'transactions',
            transport: 'callback',
            sourceType: 'local',
            txs: [unsigned],
            sourceMetadata: source,
            approve: async ([signed]) => {
                if (signed) {
                    resolve(signed)
                } else {
                    reject(new Error('The swap transaction came back unsigned'))
                }
            },
            reject: async () => {
                reject(new UserRejectedSigningError())
            },
            error: async (error: Error) => {
                reject(error)
            },
        }
        addSignRequest(request)
    })

/** `maxCost` in wei: what the signature could spend of the native asset. */
type BuiltCall = { unsigned: UnsignedTransaction; maxCost: bigint }

const buildCall = async (
    client: PublicClient,
    chain: EvmChain,
    scope: ChainScope,
    sender: Address,
    call: EvmSwapCall,
    summary: TransactionSummary,
): Promise<BuiltCall> => {
    const { chainId, to, value, data } = call
    const transfer: EvmTransferCall = { chainId, from: sender, to, value, data }
    const [nonce, fees] = await Promise.all([
        allocateEthereumNonce({ client, scope, sender }),
        readTransferGasAndPresets(client, transfer, chain, scope.networkId),
    ])
    const { maxFeePerGas, maxPriorityFeePerGas } = fees.presets.normal
    const payload: EthereumTransactionPayload = {
        from: sender,
        transaction: {
            type: 'eip1559',
            chainId,
            nonce,
            to,
            value,
            data,
            gas: fees.gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas,
        },
    }
    return {
        unsigned: { scope, payload, summary, chainData: { family: 'evm' } },
        maxCost: value + fees.gasLimit * maxFeePerGas,
    }
}

const submit = (
    client: PublicClient,
    chain: EvmChain,
    { scope, summary, chainData }: UnsignedTransaction,
    signed: SignedTransaction,
): Promise<string[]> =>
    submitAndRecordEthereumTransactions({
        client,
        chain,
        scope,
        signedTransactions: [signed.bytes],
        flow: 'swap',
        historyEntries: [{ summary, chainData }],
    })

type SignedCall = { unsigned: UnsignedTransaction; signed: SignedTransaction }

const isSignedCall = (
    outcome: SignedCall | ExecuteSwapResult,
): outcome is SignedCall => 'signed' in outcome

const buildAndSign = async (
    client: PublicClient,
    chain: EvmChain,
    sender: Address,
    call: EvmSwapCall,
    summary: TransactionSummary,
    { signingSource }: ExecuteSwapParams,
    { scope, addSignRequest }: SwapExecutionContext,
): Promise<SignedCall | ExecuteSwapResult> => {
    let built: BuiltCall
    let shortfall: ReturnType<typeof evmShortfallOf>
    try {
        built = await buildCall(client, chain, scope, sender, call, summary)
        shortfall = evmShortfallOf(
            await client.getBalance({ address: sender }),
            built.maxCost,
        )
    } catch (error) {
        logger.warn('[swap] building a transaction failed', {
            error: `${error}`,
        })
        return failed({
            phase: 'prepare',
            reason: 'prepare-failed',
            error: toEvmError(error, chain.row.nativeAsset.symbol),
        })
    }
    if (shortfall) {
        return failed({
            phase: 'prepare',
            reason: 'insufficient-native-balance',
            chainId: scope.chainId,
            shortfall,
        })
    }
    try {
        return {
            unsigned: built.unsigned,
            signed: await requestSignature(
                addSignRequest,
                signingSource,
                built.unsigned,
            ),
        }
    } catch (error) {
        if (isUserRejection(error)) return { kind: 'user-rejected' }
        logger.warn('[swap] signing failed', { error: `${error}` })
        return failed({ phase: 'signing', reason: 'signing-failed' })
    }
}

// The allowance must land before the swap can even be priced, so it is signed,
// sent and awaited on its own. It moves no funds: whatever stops the flow after
// it leaves a grant no larger than this swap.
const sendApproval = async (
    client: PublicClient,
    chain: EvmChain,
    sender: Address,
    { approval, swap }: EvmSwapPlan & { approval: EvmSwapCall },
    input: ExecuteSwapParams,
    context: SwapExecutionContext,
): Promise<string | ExecuteSwapResult> => {
    const standard = decodeEvmStandardCall({ ...approval, from: sender })
    const summary = spendApprovalSummary(sender, swap.to, {
        assetRef: { chainId: chain.row.id, assetId: approval.to },
        // The check allows less than the swap's amount, so show what's granted.
        value:
            standard?.kind === 'approve'
                ? standard.value
                : input.quote.request.sourceAmount,
    })
    const outcome = await buildAndSign(
        client,
        chain,
        sender,
        approval,
        summary,
        input,
        context,
    )
    if (!isSignedCall(outcome)) return outcome
    try {
        input.onProgress('submitting')
        const [txId] = await submit(
            client,
            chain,
            outcome.unsigned,
            outcome.signed,
        )
        await waitForEvmReceipt(
            client,
            txId as Hex,
            ETHEREUM_CONFIRMATION_TIMEOUT_MS,
        )
        return txId
    } catch (error) {
        return failed({
            phase: 'submission',
            reason:
                evmErrorCodeOf(error) === EvmErrorCode.REVERTED
                    ? 'reverted'
                    : 'submission-failed',
            error,
        })
    }
}

const preflightShortfall = async (
    client: PublicClient,
    chain: EvmChain,
    routeContracts: readonly Address[],
    { quote }: ExecuteSwapParams,
    { scope }: SwapExecutionContext,
): Promise<ReturnType<typeof evmShortfallOf>> => {
    try {
        const { shortfall } = await estimateEvmSwapSourceCost({
            client,
            chain,
            quote,
            scope,
            routeContracts,
        })
        return shortfall
    } catch (error) {
        // Advisory: the node still refuses what the account can't pay.
        logger.warn('[swap] balance preflight lookup failed', {
            error: `${error}`,
        })
        return null
    }
}

const isOrderExpired = ({ expiresAt }: SwapOrder): boolean =>
    expiresAt !== null && Date.now() >= expiresAt

const isRefusedUnsent = (error: unknown): boolean =>
    error instanceof SubmissionLedgerUnreadableError ||
    (error instanceof SubmissionError &&
        error.classification === 'rejected-by-node')

/**
 * Runs a quote through preflight → order → check → approve → swap → report.
 * The approval and the swap go separately because the swap can't be priced
 * until the allowance is mined. Waits for the swap's receipt, unlike the
 * Algorand path that needs no wait: the caller refreshes balances and announces
 * the outcome as soon as this resolves.
 */
export const executeEvmSwap = async ({
    ctx,
    chain,
    routeContracts,
    input,
    context,
}: {
    ctx: ChainContext
    chain: EvmChain
    routeContracts: readonly Address[]
    input: ExecuteSwapParams
    context: SwapExecutionContext
}): Promise<ExecuteSwapResult> => {
    const { quote, account, onProgress, isCancelled } = input
    const { scope, createOrder, reportOrder } = context
    const { onOrderSubmitting, onOrderRejected } = context

    if (!isQuoteFresh(quote)) return { kind: 'stale-quote' }

    // With nothing declared the check would refuse any order, so don't create one.
    if (routeContracts.length === 0) {
        return failed({ phase: 'prepare', reason: 'quote-mismatch' })
    }

    const client = createEvmClient(scope, ctx, chain)
    const sender = getAddress(quote.request.sourceAddress)

    if (account) {
        onProgress('preparing')
        const shortfall = await preflightShortfall(
            client,
            chain,
            routeContracts,
            input,
            context,
        )
        if (isCancelled()) return { kind: 'cancelled' }
        if (shortfall) {
            return failed({
                phase: 'prepare',
                reason: 'insufficient-native-balance',
                chainId: scope.chainId,
                shortfall,
            })
        }
    }

    let order: SwapOrder
    try {
        onProgress('preparing')
        order = await createOrder(quote.quoteId)
    } catch (error) {
        if (isSwapQuoteGoneError(error)) return { kind: 'stale-quote' }
        return failed({ phase: 'prepare', reason: 'prepare-failed', error })
    }
    const { orderId } = order
    const cancelOrder = (): void => {
        void reportCancelled(reportOrder, orderId)
    }

    if (isCancelled()) {
        cancelOrder()
        return { kind: 'cancelled' }
    }

    if (await hasUndecidedAttempt(scope, sender)) {
        cancelOrder()
        return { kind: 'verifying-previous' }
    }

    const steps = signableStepsOn(order, scope.chainId)
    if (!steps) {
        cancelOrder()
        return failed({ phase: 'prepare', reason: 'unsupported-steps' })
    }
    const lastStep = steps.at(-1)
    if (!lastStep) {
        cancelOrder()
        return failed({ phase: 'prepare', reason: 'no-signable-steps' })
    }

    let plan: EvmSwapPlan
    try {
        plan = toPlan(steps, input, context, chain, routeContracts)
    } catch (error) {
        // Raw text goes to the log only; it must never reach the toast body.
        logger.warn('[swap] validation failed', { error: `${error}` })
        cancelOrder()
        return failed({ phase: 'prepare', reason: 'quote-mismatch' })
    }

    let approval: Nullable<EvmSwapCall> = plan.approval
    if (approval) {
        // The router may not check: a failed read only costs a second approval,
        // still bounded by the swap.
        const allowance = await readEvmAllowance(client, {
            token: approval.to,
            owner: sender,
            spender: plan.swap.to,
        }).catch((error: unknown) => {
            logger.warn('[swap] allowance read failed', { error: `${error}` })
            return 0n
        })
        if (allowance >= toBigInt(quote.request.sourceAmount)) {
            approval = null
        }
    }

    if (isCancelled()) {
        cancelOrder()
        return { kind: 'cancelled' }
    }

    onProgress('signing')
    const reported: SwapReportedTransaction[] = []
    if (approval) {
        const outcome = await sendApproval(
            client,
            chain,
            sender,
            { ...plan, approval },
            input,
            context,
        )
        if (typeof outcome !== 'string') {
            cancelOrder()
            return outcome
        }
        reported.push({ scope, txHash: outcome, purpose: APPROVAL_PURPOSE })

        // The wait can outlast the swap's deadline, and past it the swap reverts
        // at the user's gas. The grant stays: it covers the re-quoted swap too.
        if (!isQuoteFresh(quote) || isOrderExpired(order)) {
            cancelOrder()
            return { kind: 'stale-quote' }
        }
    }

    const { sourceAsset, sourceAmount } = quote.request
    const outcome = await buildAndSign(
        client,
        chain,
        sender,
        plan.swap,
        swapSummary(sender, plan.swap.to, {
            assetRef: {
                chainId: sourceAsset.chainId,
                assetId: sourceAsset.assetId,
            },
            value: sourceAmount,
        }),
        input,
        context,
    )
    if (!isSignedCall(outcome)) {
        cancelOrder()
        return outcome
    }

    let swapTxId: string
    onOrderSubmitting(orderId)
    try {
        onProgress('submitting')
        ;[swapTxId] = await submit(
            client,
            chain,
            outcome.unsigned,
            outcome.signed,
        )
    } catch (error) {
        if (isRefusedUnsent(error)) onOrderRejected(orderId)
        return failed({
            phase: 'submission',
            reason: 'submission-failed',
            error,
        })
    }
    reported.push({ scope, txHash: swapTxId, purpose: lastStep.purpose })

    try {
        onProgress('updating-status')
        await reportOrder({
            orderId,
            report: { status: 'sent', transactions: reported },
        })
    } catch {
        logger.warn(
            'Failed to report the swap order, transactions already submitted',
        )
    }

    try {
        await waitForEvmReceipt(
            client,
            swapTxId as Hex,
            ETHEREUM_CONFIRMATION_TIMEOUT_MS,
        )
    } catch (error) {
        if (evmErrorCodeOf(error) === EvmErrorCode.REVERTED) {
            return failed({
                phase: 'submission',
                reason: 'reverted',
                error,
            })
        }
        // Reported and in the ledger: the reconciler settles it from here.
        logger.warn('[swap] receipt not read in time', { error: `${error}` })
    }

    return {
        kind: 'success',
        orderId,
        txIds: reported.map(({ txHash }) => txHash),
    }
}
