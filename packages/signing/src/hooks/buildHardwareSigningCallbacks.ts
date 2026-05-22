/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    isHardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useHardwareSigningStore } from '../store'
import type { SigningCallbacks } from '../pipeline/types'
import { type SignRequest } from '../models'
import {
    classifyLedgerErrorKind,
    isLedgerError,
} from '../utils/classifyLedgerErrorKind'

/**
 * Build SigningCallbacks that drive the hardware-signing UI store.
 *
 * Translates strategy-emitted phase signals (connecting / awaiting-approval),
 * signing-start, progress, and error events into the store-level actions
 * that back the LedgerSigningContent sheet. The error path uses
 * {@link classifyLedgerErrorKind} so the overlay can render preset-specific
 * copy without a UI-layer dependency reaching into the signing package.
 *
 * The signer account is taken at callback-build time (not lazily) so the
 * overlay can show the device name from the very first `onPhaseChange`.
 *
 * Exported so callback-level behavior can be unit-tested in isolation —
 * see `buildHardwareSigningCallbacks.spec.ts`.
 */
export const buildHardwareSigningCallbacks = (
    request: SignRequest,
    signerAccount: WalletAccount | undefined,
): SigningCallbacks => {
    const deviceName =
        signerAccount && isHardwareWalletAccount(signerAccount)
            ? signerAccount.hardwareDetails.deviceName
            : null

    const operation =
        request.type === 'arc60' || request.type === 'arbitrary-data'
            ? 'data'
            : 'transaction'

    return {
        onPhaseChange: phase => {
            const store = useHardwareSigningStore.getState()
            if (phase === 'connecting') {
                store.start(request.id, deviceName, operation)
            } else if (phase === 'awaiting-approval') {
                store.setStatus('awaitingApproval')
            }
        },
        onSigningStart: () => {
            useHardwareSigningStore.getState().setStatus('signing')
        },
        onProgress: (current, total) => {
            // Update progress counters only. Status transitions are driven by
            // onPhaseChange (which createHardwareStrategy emits before each
            // signTransaction call) — decoupling progress from status means
            // skipped indices never incorrectly flip the overlay to
            // 'awaitingApproval', and the 'signing' state set by onSigningStart
            // remains observable until the first onPhaseChange fires.
            useHardwareSigningStore.getState().setProgress(current, total)
        },
        onError: error => {
            // Only genuine Ledger device/transport errors drive the hardware
            // overlay (and, for BLE-class kinds, the troubleshooting sheet).
            // Non-device failures — e.g. an ARC-60 validation error, which the
            // strategy wraps in a SigningError — must NOT set the store error:
            // the lifecycle's terminal handler keys its "is this a BLE-class
            // failure?" check off `hardwareStore.error?.kind`, so setting any
            // kind here would keep the troubleshooting sheet pinned open
            // instead of letting the failure surface as the inline red error
            // in the sign-request sheet.
            if (!isLedgerError(error)) return
            const kind = classifyLedgerErrorKind(error)
            useHardwareSigningStore.getState().setError({ kind, cause: error })
        },
    }
}
