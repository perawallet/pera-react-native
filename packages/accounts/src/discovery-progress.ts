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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    HdIndex,
    WalletDiscoveryCoverage,
    WalletDiscoveryProgress,
} from './models'
import { hdPathKey, type HdProbeOutcome, type ProbedHdIndex } from './hd-walk'

export type WalletDiscoveryTracker = {
    onProbeSettled: (chainId: ChainId, outcome: HdProbeOutcome) => void
    onBatchProbed: (batch: readonly HdIndex[]) => void
    onFound: (found: readonly ProbedHdIndex[]) => void
    /**
     * The chains that failed or left a batch partly unanswered. A chain the
     * walk never reached because it threw is unchecked, so it counts; one a
     * cancel stopped first is just unfinished.
     */
    failedChainIds: (isCancelled: boolean) => ChainId[]
    coverage: (
        failedChainIds: readonly ChainId[],
        isWalkIncomplete: boolean,
    ) => WalletDiscoveryCoverage
}

type TrackerParams = {
    chainIds: readonly ChainId[]
    onProgress?: (progress: WalletDiscoveryProgress) => void
    /** True for an active index the wallet already holds, which is not news. */
    isHeld: (found: ProbedHdIndex) => boolean
}

/**
 * One record of how a wallet walk went, for the rescan and the import alike:
 * what each chain answered, which are down, and how far the walk got. Reports
 * progress once as it is created and again on every change.
 */
export const createWalletDiscoveryTracker = ({
    chainIds,
    onProgress,
    isHeld,
}: TrackerParams): WalletDiscoveryTracker => {
    const outcomes = new Map<ChainId, Set<HdProbeOutcome>>()
    const failedSoFar = new Set<ChainId>()
    // Switched off on the backend: not a network the user can scan, so it
    // leaves the progress rows.
    const refused = new Set<ChainId>()
    const found = new Set<string>()
    let checkedAccountCount = 0

    const reportProgress = () =>
        onProgress?.({
            chainIds: chainIds.filter(chainId => !refused.has(chainId)),
            failedChainIds: chainIds.filter(chainId =>
                failedSoFar.has(chainId),
            ),
            checkedAccountCount,
            foundCount: found.size,
        })
    reportProgress()

    return {
        onProbeSettled: (chainId, outcome) => {
            const settled = outcomes.get(chainId) ?? new Set()
            settled.add(outcome)
            outcomes.set(chainId, settled)
            // Partial counts too: the result names the chain as unchecked
            // either way.
            if (outcome === 'failed' || outcome === 'partial') {
                failedSoFar.add(chainId)
                reportProgress()
            } else if (outcome === 'refused') {
                refused.add(chainId)
                reportProgress()
            }
        },
        onBatchProbed: batch => {
            checkedAccountCount = Math.max(
                checkedAccountCount,
                ...batch.map(({ account }) => account + 1),
            )
            reportProgress()
        },
        onFound: entries => {
            for (const entry of entries) {
                if (!isHeld(entry)) found.add(hdPathKey(entry.index))
            }
            reportProgress()
        },
        failedChainIds: isCancelled =>
            chainIds.filter(chainId => {
                const settled = outcomes.get(chainId)
                if (!settled) return !isCancelled
                return settled.has('failed') || settled.has('partial')
            }),
        coverage: (failedChainIds, isWalkIncomplete) => {
            const hasAnswer = [...outcomes.values()].some(
                settled => settled.has('answered') || settled.has('partial'),
            )
            // With no chain left to ask (every one refused, or a retry of
            // chains no longer offered), no answer is not a failure to get one.
            const hasCheckableChain = chainIds.some(
                chainId => !refused.has(chainId),
            )
            if (!hasAnswer && hasCheckableChain) return 'unanswered'
            if (isWalkIncomplete || failedChainIds.length > 0) return 'partial'
            return 'complete'
        },
    }
}
