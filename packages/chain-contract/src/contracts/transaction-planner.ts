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

import type {
    Signature,
    SignedTransaction,
    SigningRequest,
    UnsignedTransaction,
} from '../models/domain'
import type { ChainId } from '../models/identity'
import { createChainAdapterRegistry } from '../registry'

/**
 * How a chain gets one of its transactions signed: the signatures it needs,
 * then the transaction they complete. Only the planner reads `payload`, so it
 * is the trust boundary for one a dApp sent.
 */
export interface TransactionPlanner {
    readonly chainId: ChainId
    /**
     * One request per signature, numbered from 0. Throws for another chain's
     * transaction or a payload it can't read.
     */
    plan(transaction: UnsignedTransaction): SigningRequest[]
    /**
     * Throws unless `signatures` are enough for the transaction, each from its
     * planned signer in its planned scheme. May verify them first, so it can
     * answer asynchronously.
     */
    assemble(
        transaction: UnsignedTransaction,
        signatures: Signature[],
    ): SignedTransaction | Promise<SignedTransaction>
}

export const transactionPlanners =
    createChainAdapterRegistry<TransactionPlanner>('transactionPlanner')
