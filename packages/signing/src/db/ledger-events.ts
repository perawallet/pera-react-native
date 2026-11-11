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

import { logger } from '@perawallet/wallet-core-shared'

type SubmissionLedgerListener = () => void

const listeners = new Set<SubmissionLedgerListener>()

/**
 * Called after any write that opens or settles an attempt, so readers of the
 * open set (the spendable balance) refresh. Returns the unsubscribe.
 */
export const subscribeToSubmissionLedger = (
    listener: SubmissionLedgerListener,
): (() => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

// The write has already committed: a throwing listener must not fail it.
export const notifySubmissionLedgerChanged = (): void => {
    for (const listener of listeners) {
        try {
            listener()
        } catch (error) {
            logger.warn('submission ledger listener failed', { error })
        }
    }
}

export type SubmissionOutcome = 'confirmed' | 'failed'

type SettledStatus = SubmissionOutcome | 'replaced'

const RECENTLY_SETTLED_LIMIT = 256

const watchers = new Map<string, (outcome: SubmissionOutcome) => void>()
// A settle can land before the caller learns the txId (a lost submit response
// that verified on chain, a swap whose receipt wait outlasts the reconciler),
// so a late watch is answered from here.
// ponytail: count-capped, a late watch on an evicted txId stays silent
const recentlySettled = new Map<string, SettledStatus>()

const deliver = (
    onOutcome: (outcome: SubmissionOutcome) => void,
    status: SettledStatus,
): void => {
    if (status === 'replaced') return
    try {
        onOutcome(status)
    } catch (error) {
        logger.warn('submission outcome watcher failed', { error })
    }
}

/**
 * Calls `onOutcome` once when the attempt holding `txId` settles confirmed or
 * failed, or at once if it already has. A replaced attempt never calls it.
 * One watcher per txId: a second watch replaces the first. In-memory only, so
 * an attempt the reconciler settles after a relaunch is not reported.
 */
export const watchSubmissionOutcome = (
    txId: string,
    onOutcome: (outcome: SubmissionOutcome) => void,
): void => {
    const settled = recentlySettled.get(txId)
    if (settled !== undefined) {
        deliver(onOutcome, settled)
        return
    }
    watchers.set(txId, onOutcome)
}

/**
 * A new attempt for a txId supersedes whatever settled it before, so a
 * byte-identical retry of a refused transaction is not answered 'failed'.
 */
export const forgetSettled = (txIds: readonly string[]): void => {
    for (const txId of txIds) recentlySettled.delete(txId)
}

export const notifySubmissionSettled = (
    txIds: readonly string[],
    status: SettledStatus,
): void => {
    for (const txId of txIds) {
        recentlySettled.delete(txId)
        recentlySettled.set(txId, status)
        if (recentlySettled.size > RECENTLY_SETTLED_LIMIT) {
            const oldest = recentlySettled.keys().next().value
            if (oldest !== undefined) recentlySettled.delete(oldest)
        }
        const onOutcome = watchers.get(txId)
        if (onOutcome) {
            watchers.delete(txId)
            deliver(onOutcome, status)
        }
    }
}
