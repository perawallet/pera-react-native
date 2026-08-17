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
    FAILURE_SIGN_REQUEST_STATUSES,
    type SignRequestStatus,
} from '@perawallet/wallet-core-multisig'

export type StatusBannerVariant =
    | 'waiting'
    | 'submitting'
    | 'success'
    | 'failure'

/**
 * @param isUndeliverable - the signatures are complete but the wallet could
 * not hand the signed transaction back to the dApp that requested it. The
 * backend keeps such a record at `ready`/`submitting` and never broadcasts it
 * (`sync` requests are the wallet's to deliver), so the intermediate banner
 * would promise a submission that can never happen.
 */
export const getStatusBannerVariant = (
    status: SignRequestStatus | null,
    isFailureWithinRecoveryWindow = false,
    isUndeliverable = false,
): StatusBannerVariant => {
    if (!status) return 'waiting'
    if (status === 'confirmed') return 'success'
    if (isUndeliverable && (status === 'ready' || status === 'submitting')) {
        return 'failure'
    }
    // A `failed` status on an async (in-app) broadcast can be a transient
    // backend false-negative for a transaction that actually confirmed on
    // chain. While still inside the recovery window, keep the request on the
    // intermediate "submitting" banner and keep polling so a later `confirmed`
    // supersedes it — mirrors iOS (polls the open sheet until `confirmed`) and
    // Android (treats threshold-met as success and never surfaces
    // submitting→failed). `expired`/`declined` are genuine terminal states and
    // are never suppressed.
    if (status === 'failed' && isFailureWithinRecoveryWindow) {
        return 'submitting'
    }
    if (FAILURE_SIGN_REQUEST_STATUSES.has(status)) return 'failure'
    // `ready` (threshold met, awaiting backend submission) and `submitting`
    // (in-flight) collapse into the same intermediate banner — distinguishes
    // "all sigs collected, on its way" from "still collecting".
    if (status === 'ready' || status === 'submitting') return 'submitting'
    return 'waiting'
}
