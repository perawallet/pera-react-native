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

// apps/mobile is barred (oxlint no-restricted-globals) from touching the ambient
// `chrome` global, so it reaches the approval bridge through this typed wrapper.
import type { SerializedCredential } from '@perawallet/wallet-core-passkeys/webauthn'
import type { WireWalletOperationResult } from '../connections/protocol'
import { DAPP_APPROVAL_SCOPE, type PendingApproval } from './approval-bridge'

const isPendingApproval = (value: unknown): value is PendingApproval =>
    typeof value === 'object' && value !== null && 'origin' in value

/**
 * The caller must NOT close its window on this: the dApp has not been answered,
 * and closing would show the user a success that was never delivered.
 */
export class ApprovalDeliveryError extends Error {
    constructor(kind: string, detail: string) {
        super(`Could not deliver '${kind}' to the approval bridge: ${detail}`)
        this.name = 'ApprovalDeliveryError'
    }
}

/**
 * `ApprovalWindowBridge.pending` lives in service-worker memory and MV3 evicts
 * an idle worker while an approval window sits open, so a late Approve gets
 * `{ok: false, error: 'unknown request'}`. That must surface, not close the window.
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

export const resolveConnectionRequest = async (
    requestId: string,
    result: WireWalletOperationResult,
): Promise<void> =>
    deliverDecision('resolve-connection-request', { requestId, result })

export const resolvePasskey = async (
    requestId: string,
    credential: SerializedCredential,
): Promise<void> =>
    deliverDecision('resolve-passkey', { requestId, credential })

// `reason` is 'declined' for an explicit user decline, otherwise the Error.name
// of the failed authenticator ceremony (e.g. 'SecurityError'). Never leave the request unsettled.
export const rejectPasskey = async (
    requestId: string,
    reason: string,
): Promise<void> => deliverDecision('reject-passkey', { requestId, reason })
