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

// Approval-window (popup UI) side of the approval bridge (Task 4's
// ApprovalWindowBridge.handleMessage): a typed chrome.runtime.sendMessage
// wrapper so apps/mobile — which is barred by oxlint's
// no-restricted-globals rule from touching the ambient `chrome` global
// directly — has a package-level accessor to go through instead, same as
// every other chrome API surface it needs.
import { DAPP_APPROVAL_SCOPE, type PendingApproval } from './approval-bridge'

const isPendingApproval = (value: unknown): value is PendingApproval =>
    typeof value === 'object' && value !== null && 'origin' in value

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
): Promise<void> => {
    await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'resolve-approval',
        requestId,
        approvedAddresses,
    })
}

export const rejectApproval = async (requestId: string): Promise<void> => {
    await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'reject-approval',
        requestId,
    })
}

export const resolveSignTransactions = async (
    requestId: string,
    stxns: (string | null)[],
): Promise<void> => {
    await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'resolve-sign-transactions',
        requestId,
        stxns,
    })
}

export const resolveSignMessage = async (
    requestId: string,
    signature: string,
): Promise<void> => {
    await chrome.runtime.sendMessage({
        scope: DAPP_APPROVAL_SCOPE,
        kind: 'resolve-sign-message',
        requestId,
        signature,
    })
}
