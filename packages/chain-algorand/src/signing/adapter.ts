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
    Address,
    aggregateTransactionWarnings,
    encodeTransactionRaw,
    mapToDisplayableTransaction,
    resolveArc0001SignTxnRequest,
    toAlgorandNative,
    useFetchSuggestedMinFee,
} from '../blockchain'
import {
    isUnsignedTransaction,
    type LocalKeySignerChainAdapter,
    type MessageSignerChainAdapter,
    type PlannerChainAdapter,
    type ReviewerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { canSignArbitraryData } from '@perawallet/wallet-core-accounts'
import { canSignArc60, isQuantumAccount } from '../accounts/vocabulary'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import {
    algorandSignableDataOf,
    algorandSignedForAddresses,
    algorandTransactionsOf,
    readableAlgorandTransaction,
} from './algorandRequest'
import { decodeArbitraryDataForDisplay } from './arbitraryDataDisplay'
import { computeBalanceImpact } from './balanceImpact'
import {
    algorandViewOf,
    classifyRequestStructure,
    createTransactionListItems,
} from './classification'
import { enqueueArc0001SignRequest } from './enqueueArc0001SignRequest'
import {
    useAlgorandFeeConfig,
    useAlgorandSuggestedMinFeeQuery,
} from './feeHooks'
import { calculateTotalFee, detectHighGroupFee } from './fees'
import {
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
} from './getRekeyedUnsignableReason'
import { encodeDelegatedLsigAccount, programSigningPayload } from './lsig'
import { mergeSigningResults } from './mergeSigningResults'
import { algorandSignedTransactionsOf } from './signedTransactions'
import { validateArc60AuthRequest } from './message/arc60'
import { isArc60WirePayload, parseArc60WireRequest } from './message/arc60-wire'
import { parseArc60ForDisplay } from './message/parseArc60ForDisplay'
import {
    assembleAlgorandMessage,
    describeAlgorandMessage,
    planAlgorandMessage,
    supportsAlgorandMessageMethod,
} from './message/messageSigner'
import { buildSiwxAuthData } from './message/siwx'
import { resolveMinFeeForSender } from './minFeeResolver'
import { simulateInnerTransactions } from './simulateImpact'
import { useAssignFeeToGroup } from './useAssignFeeToGroup'
import { useMinFeeForSender } from './useMinFeeForSender'
import { createLocalKeyStrategy } from './local-key/createLocalKeyStrategy'
import { signLocalKeyGroups } from './local-key/signLocalKeyGroups'
import {
    assembleSignedTransaction,
    signTransactionsWithLocalKey,
} from './local-key/signTransactionsWithLocalKey'
import {
    classifyHandoffPoll,
    resolveHandoffOutcome,
} from './multisig/classifyHandoffPoll'
import { completeMultisigHandoff } from './multisig/completeMultisigHandoff'
import { createMultisigCosignTransport } from './multisig/createMultisigCosignTransport'
import { createMultisigProposeTransport } from './multisig/createMultisigProposeTransport'
import { createMultisigStrategy } from './multisig/createMultisigStrategy'
import { draftProposeContexts } from './multisig/draftProposeContexts'
import { isSignRequestMultisigUnsignable } from './multisig/isSignRequestMultisigUnsignable'
import { signMultisigGroups } from './multisig/signMultisigGroups'
import {
    validateCosignSubsetIntegrity,
    validateTransactionGroupIntegrity,
} from './validateTransactionGroupIntegrity'
import {
    algorandReviewPolicy,
    algorandTransactionDecoder,
    algorandWarningDetector,
} from './review'

export const algorandReviewerAdapter: ReviewerChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    decoder: algorandTransactionDecoder,
    warnings: algorandWarningDetector,
    policy: algorandReviewPolicy,
    createTransactionListItems,
    classifyRequestStructure,
    aggregateTransactionWarnings: (transactions, ...rest) =>
        aggregateTransactionWarnings(transactions.map(algorandViewOf), ...rest),
    resolveAllSignerAddresses,
    getDelegatedUnsignableReason: getRekeyedUnsignableReason,
    decodeArbitraryDataForDisplay,
    toTransactionNative: transaction => {
        const algorand = isUnsignedTransaction(transaction)
            ? readableAlgorandTransaction(transaction)
            : transaction
        const view = algorand && mapToDisplayableTransaction(algorand)
        return view ? toAlgorandNative(view) : null
    },
}

export const algorandPlannerAdapter: PlannerChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    resolveDappRequest: resolveArc0001SignTxnRequest,
    enqueueDappRequest: enqueueArc0001SignRequest,
    minFeeForSender: resolveMinFeeForSender,
    useFeeConfig: useAlgorandFeeConfig,
    useSuggestedMinFeeQuery: useAlgorandSuggestedMinFeeQuery,
    useFetchSuggestedMinFee,
    useMinFeeForSender,
    useAssignFeeToGroup,
    encodeUnsignedTransaction: encodeTransactionRaw,
    reviewGroupFees: (transactions, signableAddresses) => {
        const views = transactions.map(algorandViewOf)
        return {
            totalFee: calculateTotalFee(views, signableAddresses),
            highFeeWarning: detectHighGroupFee(views, signableAddresses),
        }
    },
    computeBalanceImpact: (transactions, userAddresses) =>
        computeBalanceImpact(transactions.map(algorandViewOf), userAddresses),
    needsSimulation: transactions =>
        transactions.some(tx => algorandViewOf(tx).txType === 'appl'),
    simulateGroup: async (groupTxs, network) =>
        (
            await simulateInnerTransactions(
                algorandTransactionsOf(groupTxs),
                network,
            )
        ).map(toAlgorandNative),
    programPayload: programSigningPayload,
    encodeProgramAccount: encodeDelegatedLsigAccount,
    validateGroup: (transactions, { isCosigner }) => {
        const algorand = algorandTransactionsOf(transactions)
        return isCosigner
            ? validateCosignSubsetIntegrity(algorand)
            : validateTransactionGroupIntegrity(algorand)
    },
    readTransactionsData: algorandSignableDataOf,
    signedForAddresses: algorandSignedForAddresses,
    mergeSigningResults,
    signedTransactionsOf: algorandSignedTransactionsOf,
    assembleSignedTransaction,
    createMultisigStrategy,
    signMultisigGroups,
    createMultisigProposeTransport,
    createMultisigCosignTransport,
    takeDraftProposeContext: draftProposeContexts.take,
    classifyHandoffPoll,
    resolveHandoffOutcome,
    completeMultisigHandoff,
    isSignRequestMultisigUnsignable,
}

export const algorandLocalKeySignerAdapter: LocalKeySignerChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    signTransactions: signTransactionsWithLocalKey,
    createStrategy: createLocalKeyStrategy,
    signGroups: signLocalKeyGroups,
}

export const algorandMessageSignerAdapter: MessageSignerChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    canSign: (account, kind) =>
        kind === 'authData'
            ? canSignArc60(account)
            : canSignArbitraryData(account),
    // ARC-60 and arbitrary-data signatures are Ed25519-only, so no dApp can
    // verify a quantum account's Falcon signature yet.
    signsVerifiably: account => !isQuantumAccount(account),
    supports: supportsAlgorandMessageMethod,
    describe: describeAlgorandMessage,
    plan: planAlgorandMessage,
    assemble: assembleAlgorandMessage,
    validateAuthData: validateArc60AuthRequest,
    parseAuthDataForDisplay: parseArc60ForDisplay,
    isAuthDataWirePayload: isArc60WirePayload,
    parseAuthDataWireRequest: parseArc60WireRequest,
    buildSiwxAuthData,
    signerPublicKey: address => Address.fromString(address).publicKey,
}
