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

import { resolveArc0001SignTxnRequest } from '@perawallet/wallet-core-blockchain'
import type {
    PlannerChainAdapter,
    ReviewerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { decodeArbitraryDataForDisplay } from './arbitraryDataDisplay'
import { assignFeeToGroup } from './assignMinimumFeesToGroup'
import { computeBalanceImpact } from './balanceImpact'
import {
    classifyRequestStructure,
    createTransactionListItems,
} from './classification'
import { createStandardAnalyzer } from './createStandardAnalyzer'
import { enqueueArc0001SignRequest } from './enqueueArc0001SignRequest'
import { calculateTotalFee, detectHighGroupFee } from './fees'
import {
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
} from './getRekeyedUnsignableReason'
import { encodeDelegatedLsigAccount, programSigningPayload } from './lsig'
import { mergeSigningResults } from './mergeSigningResults'
import { resolveMinFeeForSender } from './minFeeResolver'
import { simulateInnerTransactions } from './simulateImpact'
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
}

export const algorandPlannerAdapter: PlannerChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    resolveDappRequest: resolveArc0001SignTxnRequest,
    enqueueDappRequest: enqueueArc0001SignRequest,
    minFeeForSender: resolveMinFeeForSender,
    assignGroupFees: assignFeeToGroup,
    reviewGroupFees: (transactions, signableAddresses) => ({
        totalFee: calculateTotalFee(transactions, signableAddresses),
        highFeeWarning: detectHighGroupFee(transactions, signableAddresses),
    }),
    computeBalanceImpact,
    needsSimulation: transactions =>
        transactions.some(tx => tx.txType === 'appl'),
    simulateGroup: simulateInnerTransactions,
    delegationPayload: programSigningPayload,
    encodeDelegation: encodeDelegatedLsigAccount,
    validateGroup: (transactions, { isCosigner }) =>
        isCosigner
            ? validateCosignSubsetIntegrity(transactions)
            : validateTransactionGroupIntegrity(transactions),
    mergeSigningResults,
}
