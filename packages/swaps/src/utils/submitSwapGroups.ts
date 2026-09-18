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
    SubmissionError,
    type IntentKey,
} from '@perawallet/wallet-core-signing'

export type SwapGroupState = {
    status: 'pending' | 'landed'
    txIds: string[]
}

export type SubmitSwapGroupsResult =
    | { kind: 'all-submitted'; txIds: string[]; groupStates: SwapGroupState[] }
    // At least one group's bytes may be on chain. The remaining groups are
    // still signed and re-broadcastable as-is.
    | {
          kind: 'partial'
          txIds: string[]
          groupStates: SwapGroupState[]
          error: unknown
      }
    // Nothing was broadcast — a clean retry is safe.
    | { kind: 'failed'; error: unknown }

export type SubmitSwapGroupsParams<TGroup> = {
    groups: TGroup[]
    swapId?: string
    /** Per-group outcomes of an earlier attempt; landed groups are skipped. */
    resume?: SwapGroupState[]
    submitGroup: (
        group: TGroup,
        options: { intentKey: IntentKey | undefined },
    ) => Promise<string[]>
    isEmptyGroup?: (group: TGroup) => boolean
}

/**
 * An unknown-outcome submit may still land, so the group counts as landed and
 * its txIds are kept: reconciliation settles it, and re-broadcasting the same
 * bytes would be redundant rather than corrective.
 */
const landedTxIdsFrom = (error: unknown): string[] | null =>
    error instanceof SubmissionError &&
    error.classification === 'unknown-outcome'
        ? error.txIds
        : null

export const submitSwapGroups = async <TGroup>({
    groups,
    swapId,
    resume,
    submitGroup,
    isEmptyGroup,
}: SubmitSwapGroupsParams<TGroup>): Promise<SubmitSwapGroupsResult> => {
    const groupStates: SwapGroupState[] = groups.map(
        (_, index) =>
            resume?.[index] ?? { status: 'pending' as const, txIds: [] },
    )

    for (const [index, group] of groups.entries()) {
        if (groupStates[index]?.status === 'landed') continue
        if (isEmptyGroup?.(group)) {
            groupStates[index] = { status: 'landed', txIds: [] }
            continue
        }

        // A swap without an id has no stable identity — a blank key would
        // collide unrelated swaps.
        const intentKey: IntentKey | undefined = swapId
            ? { kind: 'swap', swapId, group: index }
            : undefined

        try {
            const txIds = await submitGroup(group, { intentKey })
            groupStates[index] = { status: 'landed', txIds }
        } catch (error) {
            const maybeLanded = landedTxIdsFrom(error)
            if (maybeLanded !== null) {
                groupStates[index] = { status: 'landed', txIds: maybeLanded }
            }
            const txIds = collectTxIds(groupStates)
            if (txIds.length === 0) return { kind: 'failed', error }
            return { kind: 'partial', txIds, groupStates, error }
        }
    }

    return {
        kind: 'all-submitted',
        txIds: collectTxIds(groupStates),
        groupStates,
    }
}

const collectTxIds = (groupStates: SwapGroupState[]): string[] => [
    ...new Set(groupStates.flatMap(state => state.txIds)),
]
