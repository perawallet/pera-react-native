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

import { vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { Transaction, computeGroupID } from 'algosdk'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { bytesEqual, bytesToHex } from '@perawallet/wallet-core-shared'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import {
    plannerChainAdapters,
    type PlannerChainAdapter,
} from '../chain-adapter'
import { InvalidSignableDataError } from '../pipeline/errors'

const notStubbed = (member: string) => () => {
    throw new Error(`fake planner: ${member} is not stubbed`)
}

// Recomputes each group partition's id, which keeps a stale group refused in
// the machine's own specs without the real Algorand validator.
const recomputeGroupIds = (transactions: PeraTransaction[]): void => {
    const partitions = new Map<string, PeraTransaction[]>()
    for (const tx of transactions) {
        if (!tx.group) continue
        const key = bytesToHex(tx.group)
        partitions.set(key, [...(partitions.get(key) ?? []), tx])
    }
    for (const txs of partitions.values()) {
        const ungrouped = txs.map(tx => {
            const clone = Transaction.fromEncodingData(tx.toEncodingData())
            clone.group = undefined
            return clone
        })
        if (!bytesEqual(computeGroupID(ungrouped), txs[0].group!)) {
            throw new InvalidSignableDataError(
                'group ID does not match the transactions provided',
            )
        }
    }
}

export const fakePlannerAdapter = (
    overrides: Partial<PlannerChainAdapter> = {},
): PlannerChainAdapter => ({
    chainId: scopeForLegacyNetwork('mainnet').chainId,
    resolveDappRequest: vi.fn(notStubbed('resolveDappRequest')),
    enqueueDappRequest: vi.fn(notStubbed('enqueueDappRequest')),
    minFeeForSender: vi.fn(() => 0n),
    assignGroupFees: vi.fn(async ({ transactions }) => ({
        transactions,
        adjustments: [],
    })),
    reviewGroupFees: vi.fn(() => ({
        totalFee: new Decimal(0),
        highFeeWarning: null,
    })),
    computeBalanceImpact: vi.fn(() => ({
        deltas: [],
        totalFeeMicroAlgos: 0n,
        hasCloseRemainder: false,
        closedAssetIds: [],
        createdAssets: [],
    })),
    needsSimulation: vi.fn(() => false),
    simulateGroup: vi.fn(async () => []),
    programPayload: vi.fn((program: Uint8Array) => program),
    encodeProgramAccount: vi.fn((program: Uint8Array) => program),
    validateGroup: vi.fn((transactions, { isCosigner }) => {
        if (!isCosigner) recomputeGroupIds(transactions)
    }),
    mergeSigningResults: vi.fn(results => results[0]),
    ...overrides,
})

export const registerFakePlannerAdapter = (
    overrides: Partial<PlannerChainAdapter> = {},
): PlannerChainAdapter => {
    const adapter = fakePlannerAdapter(overrides)
    plannerChainAdapters.reset()
    plannerChainAdapters.register(adapter)
    return adapter
}
