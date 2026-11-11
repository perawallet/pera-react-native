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
