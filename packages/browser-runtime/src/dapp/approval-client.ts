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

// apps/mobile is barred (oxlint no-restricted-globals) from touching the ambient
// `chrome` global, so it reaches the approval bridge through this typed wrapper.
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import {
    dappRequestFailureOf,
    isDappUserRejection,
} from '@perawallet/wallet-core-connections/dappRequest'
import type { SerializedCredential } from '@perawallet/wallet-core-passkeys/webauthn'
import {
    AppError,
    ErrorCategory,
    toError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    encodeSignedTransactions,
    isWireSignedSendOutcome,
    type WireSignedSendOutcome,
    type WireWalletOperationResult,
} from '../connections/protocol'
import {
    APPROVAL_POPUP_PORT_PREFIX,
    DAPP_APPROVAL_SCOPE,
    toWalletFailure,
    type ConnectionRequestFailed,
    type PendingApproval,
} from './approval-bridge'

const isPendingApproval = (value: unknown): value is PendingApproval =>
    typeof value === 'object' && value !== null && 'origin' in value

/**
 * The caller must NOT close its window on this: the dApp has not been answered,
 * and closing would show the user a success that was never delivered.
 */
export class ApprovalDeliveryError extends AppError {
    constructor(kind: string, detail: string) {
        super(`Could not deliver '${kind}' to the approval bridge: ${detail}`, {
            category: ErrorCategory.CONNECTIONS,
        })
        this.name = 'ApprovalDeliveryError'
    }
}

/**
 * `ApprovalWindowBridge.pending` lives in service-worker memory and MV3 evicts
 * an idle worker while an approval window sits open, so a late Approve gets
 * `{ok: false, error: 'unknown request'}`. That must surface, not close the window.
 */
const sendDecision = async (
    kind: string,
    message: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
    let response: unknown
    try {
        response = await chrome.runtime.sendMessage({
            scope: DAPP_APPROVAL_SCOPE,
            kind,
            ...message,
        })
    } catch (cause) {
        // The worker died mid-send, or no listener remains to answer.
        throw new ApprovalDeliveryError(kind, toError(cause).message)
    }
    const ok =
        typeof response === 'object' &&
        response !== null &&
        (response as { ok?: unknown }).ok === true
    if (ok) return response as Record<string, unknown>
    const detail =
        typeof response === 'object' &&
        response !== null &&
        typeof (response as { error?: unknown }).error === 'string'
            ? (response as { error: string }).error
            : 'no acknowledgement'
    throw new ApprovalDeliveryError(kind, detail)
}

const deliverDecision = async (
    kind: string,
    message: Record<string, unknown>,
): Promise<void> => {
    await sendDecision(kind, message)
}

export const getPendingApproval = async (
    requestId: string,
): Promise<Nullable<PendingApproval>> => {
    const res: unknown = await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'get-approval',
        requestId,
    })
    return isPendingApproval(res) ? res : null
}

// Referenced for the page's life: the port closing is what tells the bridge
// this popup is gone (see APPROVAL_POPUP_PORT_PREFIX).
const claimedApprovalPorts: chrome.runtime.Port[] = []

/** Claims the toolbar popup's approval; never call it from the approval window. */
export const getCurrentApproval = async (): Promise<
    Nullable<PendingApproval>
> => {
    const res: unknown = await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'get-current-approval',
    })
    if (!isPendingApproval(res)) return null
    claimedApprovalPorts.push(
        chrome.runtime.connect({
            name: `${APPROVAL_POPUP_PORT_PREFIX}${res.requestId}`,
        }),
    )
    return res
}

export const resolveApproval = async (
    requestId: string,
    approvedAddresses: string[],
): Promise<void> =>
    deliverDecision('resolve-approval', { requestId, approvedAddresses })

export const rejectApproval = async (requestId: string): Promise<void> =>
    deliverDecision('reject-approval', { requestId })

export const resolveConnectionRequest = async (
    requestId: string,
    result: WireWalletOperationResult,
): Promise<void> =>
    deliverDecision('resolve-connection-request', { requestId, result })

/**
 * Refuses a connection request on the wallet's side; the dApp is not told the
 * user declined. A user decline is `rejectApproval`.
 */
export const failConnectionRequest = async (
    requestId: string,
    failure?: ConnectionRequestFailed['failed']['failure'],
): Promise<void> =>
    deliverDecision('fail-connection-request', { requestId, failure })

/** Answers a request the pipeline turned down, as the user's decline only when it was one. */
export const declineConnectionRequest = async (
    requestId: string,
    error: Error,
): Promise<void> =>
    isDappUserRejection(error)
        ? rejectApproval(requestId)
        : failConnectionRequest(
              requestId,
              toWalletFailure(dappRequestFailureOf(error)),
          )

/**
 * Hands a signed send to the host, which broadcasts it and answers the dApp,
 * and resolves with what the broadcast did. Throws `ApprovalDeliveryError`
 * when no outcome came back; if the bridge had already settled the approval,
 * the caller's decline that follows changes nothing.
 */
export const submitConnectionRequest = async (
    requestId: string,
    signed: readonly SignedTransaction[],
): Promise<WireSignedSendOutcome> => {
    const kind = 'submit-connection-request'
    const { outcome } = await sendDecision(kind, {
        requestId,
        signedTransactions: encodeSignedTransactions(signed),
    })
    if (!isWireSignedSendOutcome(outcome)) {
        throw new ApprovalDeliveryError(kind, 'no outcome')
    }
    return outcome
}

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
