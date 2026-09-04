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

// Approval-window (popup UI) side of the approval bridge
// (ApprovalWindowBridge.handleMessage): a typed chrome.runtime.sendMessage
// wrapper so apps/mobile — which is barred by oxlint's
// no-restricted-globals rule from touching the ambient `chrome` global
// directly — has a package-level accessor to go through instead, same as
// every other chrome API surface it needs.
import type { SerializedCredential } from '@perawallet/wallet-core-passkeys/webauthn'
import { DAPP_APPROVAL_SCOPE, type PendingApproval } from './approval-bridge'

const isPendingApproval = (value: unknown): value is PendingApproval =>
    typeof value === 'object' && value !== null && 'origin' in value

/**
 * Thrown when a decision could not be handed back to the bridge. The caller
 * must NOT close its window on this: the dApp has not been answered, and
 * closing would tell the user they approved something that was never
 * delivered.
 */
export class ApprovalDeliveryError extends Error {
    constructor(kind: string, detail: string) {
        super(`Could not deliver '${kind}' to the approval bridge: ${detail}`)
        this.name = 'ApprovalDeliveryError'
    }
}

/**
 * Sends a decision and asserts the bridge accepted it.
 *
 * Why this is not optional: `ApprovalWindowBridge.pending` lives in
 * service-worker memory, and MV3 evicts the worker while an approval window
 * sits idle (an open window emits no events to keep it alive). A user who
 * deliberates past that point clicks Approve, the bridge answers
 * `{ok: false, error: 'unknown request'}` — and every caller here used to
 * discard that and close the window, so the user saw a successful signature
 * the dApp never received.
 */
const deliverDecision = async (
    kind: string,
    message: Record<string, unknown>,
): Promise<void> => {
    let response: unknown
    try {
        response = await chrome.runtime.sendMessage({
            scope: DAPP_APPROVAL_SCOPE,
            kind,
            ...message,
        })
    } catch (cause) {
        // The worker died mid-send, or no listener remains to answer.
        throw new ApprovalDeliveryError(
            kind,
            cause instanceof Error ? cause.message : String(cause),
        )
    }
    const ok =
        typeof response === 'object' &&
        response !== null &&
        (response as { ok?: unknown }).ok === true
    if (ok) return
    const detail =
        typeof response === 'object' &&
        response !== null &&
        typeof (response as { error?: unknown }).error === 'string'
            ? (response as { error: string }).error
            : 'no acknowledgement'
    throw new ApprovalDeliveryError(kind, detail)
}

export const getPendingApproval = async (
    requestId: string,
): Promise<PendingApproval | null> => {
    const res: unknown = await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'get-approval',
        requestId,
    })
    return isPendingApproval(res) ? res : null
}

export const getCurrentApproval = async (): Promise<PendingApproval | null> => {
    const res: unknown = await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'get-current-approval',
    })
    return isPendingApproval(res) ? res : null
}

export const resolveApproval = async (
    requestId: string,
    approvedAddresses: string[],
): Promise<void> =>
    deliverDecision('resolve-approval', { requestId, approvedAddresses })

export const rejectApproval = async (requestId: string): Promise<void> =>
    deliverDecision('reject-approval', { requestId })

export const resolveSignTransactions = async (
    requestId: string,
    stxns: (string | null)[],
): Promise<void> =>
    deliverDecision('resolve-sign-transactions', { requestId, stxns })

export const resolveSignMessage = async (
    requestId: string,
    signature: string,
): Promise<void> =>
    deliverDecision('resolve-sign-message', { requestId, signature })

export const resolveWcSign = async (
    requestId: string,
    result: unknown,
): Promise<void> => deliverDecision('resolve-wc-sign', { requestId, result })

export const resolvePasskey = async (
    requestId: string,
    credential: SerializedCredential,
): Promise<void> =>
    deliverDecision('resolve-passkey', { requestId, credential })

// `reason` is a WebAuthn-ish error name ('declined' for an explicit user
// decline, or an Error.name like 'SecurityError'/'InvalidStateError' from a
// failed authenticator ceremony) — never leave the request unsettled, see
// usePasskeyApproval.
export const rejectPasskey = async (
    requestId: string,
    reason: string,
): Promise<void> => deliverDecision('reject-passkey', { requestId, reason })
