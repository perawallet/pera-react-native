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
    encodeTransactionRaw,
    mapToDisplayableTransaction,
    resolveArc0001SignTxnRequest,
    useFetchSuggestedMinFee,
} from '@perawallet/wallet-core-blockchain'
import type {
    LocalKeySignerChainAdapter,
    MessageSignerChainAdapter,
    PlannerChainAdapter,
    ReviewerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { decodeArbitraryDataForDisplay } from './arbitraryDataDisplay'
import { computeBalanceImpact } from './balanceImpact'
import {
    classifyRequestStructure,
    createTransactionListItems,
} from './classification'
import { createStandardAnalyzer } from './createStandardAnalyzer'
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
import { validateArc60AuthRequest } from './message/arc60'
import { isArc60WirePayload, parseArc60WireRequest } from './message/arc60-wire'
import { parseArc60ForDisplay } from './message/parseArc60ForDisplay'
import { signArbitraryData } from './message/signArbitraryData'
import { signArc60AuthRequest } from './message/signArc60AuthRequest'
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
import { aggregateTransactionWarnings } from './warnings'

export const algorandReviewerAdapter: ReviewerChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    analyze: createStandardAnalyzer().analyze,
    createTransactionListItems,
    classifyRequestStructure,
    aggregateTransactionWarnings,
    resolveAllSignerAddresses,
    getRekeyedUnsignableReason,
    decodeArbitraryDataForDisplay,
    toDisplayableTransaction: mapToDisplayableTransaction,
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
    reviewGroupFees: (transactions, signableAddresses) => ({
        totalFee: calculateTotalFee(transactions, signableAddresses),
        highFeeWarning: detectHighGroupFee(transactions, signableAddresses),
    }),
    computeBalanceImpact,
    needsSimulation: transactions =>
        transactions.some(tx => tx.txType === 'appl'),
    simulateGroup: simulateInnerTransactions,
    programPayload: programSigningPayload,
    encodeProgramAccount: encodeDelegatedLsigAccount,
    validateGroup: (transactions, { isCosigner }) =>
        isCosigner
            ? validateCosignSubsetIntegrity(transactions)
            : validateTransactionGroupIntegrity(transactions),
    mergeSigningResults,
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
    signArbitraryData,
    signAuthData: signArc60AuthRequest,
    validateAuthData: validateArc60AuthRequest,
    parseAuthDataForDisplay: parseArc60ForDisplay,
    isAuthDataWirePayload: isArc60WirePayload,
    parseAuthDataWireRequest: parseArc60WireRequest,
    buildSiwxAuthData,
    signerPublicKey: address => Address.fromString(address).publicKey,
}
