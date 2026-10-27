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

import { VerificationState } from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AccountPreparation } from './useFinishRegistrationOnVerified'

/**
 * The "Submit Your Documents" checklist row's visual state.
 * - `locked`: the details aren't in yet, and KYC only starts after them.
 * - `unverified`: KYC not submitted yet (or state unknown).
 * - `pending`: submitted and under review.
 * - `preparing` / `preparing-slow`: verified, and Baanx is still creating
 *   the account (for longer than usual in the second case).
 * - `preparing-stalled`: the same, with no logins left this session.
 * - `account-locked`: Baanx locked the account after repeated failed logins.
 */
export type DocumentsState =
    | 'locked'
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'preparing'
    | 'preparing-slow'
    | 'preparing-stalled'
    | 'account-locked'
    | 'rejected'
    | 'error'

/**
 * Maps the polled KYC state to the documents row. Loading shows a neutral
 * pending row (no actionable CTA) so a cold entry can't flash "verify" at an
 * already-decided user. Only a submitted-but-unconfirmed review (PENDING) that
 * the poll gave up on escalates to the retry 'error' row; UNVERIFIED and
 * unmodelled/unfetched states surface the actionable 'unverified' row, unless
 * registration has already completed: the account only exists once KYC
 * verified, so `Completed` with no poll data still reads as verified.
 */
export const resolveDocumentsState = (
    isLoading: boolean,
    verificationState: Nullable<VerificationState>,
    hasPollTimedOut: boolean,
    isRegistrationComplete: boolean,
    areDetailsSubmitted: boolean,
    accountPreparation: AccountPreparation,
    isLoginLocked: boolean,
): DocumentsState => {
    if (verificationState === VerificationState.Rejected) return 'rejected'
    if (isLoginLocked) return 'account-locked'
    if (!areDetailsSubmitted) return 'locked'
    if (isLoading) return 'pending'
    switch (verificationState) {
        case VerificationState.Verified: {
            if (accountPreparation === 'preparing') return 'preparing'
            if (accountPreparation === 'slow') return 'preparing-slow'
            if (accountPreparation === 'stalled') return 'preparing-stalled'
            return 'verified'
        }
        case VerificationState.Pending: {
            return hasPollTimedOut ? 'error' : 'pending'
        }
        default: {
            return isRegistrationComplete ? 'verified' : 'unverified'
        }
    }
}
