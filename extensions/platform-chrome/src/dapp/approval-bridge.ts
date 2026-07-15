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

import { isTrustedExtensionPageSender } from './../trusted-sender'
import { type ApprovalOpener } from './router'

export const DAPP_APPROVAL_SCOPE = 'pera-dapp-approval' as const

export type PendingApproval =
    | {
          kind: 'enable'
          requestId: string
          origin: string
          faviconUrl?: string
      }
    | {
          kind: 'sign-transactions'
          requestId: string
          origin: string
          faviconUrl?: string
          txns: unknown[]
          approvedAddresses: string[]
      }
    | {
          kind: 'sign-message'
          requestId: string
          origin: string
          faviconUrl?: string
          message: Record<string, unknown>
          approvedAddresses: string[]
      }

// Each open* method creates its own typed Promise and stores its `resolve`
// here as this widened `Settle`; `finish()` stays generic over the decision
// shape so one pending map (and one window-lifecycle implementation) serves
// all approval kinds. The cast back to the caller's shape happens at each
// open* method's promise executor, not here.
type Settle = (decision: unknown) => void

export class ApprovalWindowBridge implements ApprovalOpener {
    private readonly pending = new Map<
        string,
        {
            approval: PendingApproval
            settle: Settle
            windowId?: number
            surface?: 'popup' | 'window'
        }
    >()
    private readonly windowToRequest = new Map<number, string>()
    // Ids we are about to close ourselves via finish() -> windows.remove().
    // The resulting onRemoved must be ignored, not mistaken for a user close.
    private readonly selfClosedWindowIds = new Set<number>()

    constructor(private readonly chromeLike: typeof chrome = chrome) {}

    listen(): void {
        this.chromeLike.runtime.onMessage.addListener(this.handleMessage)
        this.chromeLike.windows.onRemoved.addListener(this.handleWindowRemoved)
    }

    async openEnable(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
    }): Promise<{ approvedAddresses: string[] } | null> {
        const approval: PendingApproval = { ...ctx, kind: 'enable' }
        // `settle` is stored as the widened `Settle` above; `finish()` only
        // ever gets called for this requestId with the `{ approvedAddresses }
        // | null` shape (see handleMessage's 'resolve-approval'/
        // 'reject-approval' cases and the window-close path), so this cast
        // back to the method's own return type is safe.
        const decision = new Promise<{ approvedAddresses: string[] } | null>(
            resolve => {
                this.pending.set(ctx.requestId, {
                    approval,
                    settle: resolve as Settle,
                })
            },
        )
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    async openSignTransactions(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        txns: unknown[]
        approvedAddresses: string[]
    }): Promise<{ stxns: (string | null)[] } | null> {
        const approval: PendingApproval = { ...ctx, kind: 'sign-transactions' }
        // See openEnable's comment: finish() for this requestId only ever
        // passes a `{ stxns }` shape (handleMessage's
        // 'resolve-sign-transactions' case) or null (window-close), so this
        // cast is safe.
        const decision = new Promise<{ stxns: (string | null)[] } | null>(
            resolve => {
                this.pending.set(ctx.requestId, {
                    approval,
                    settle: resolve as Settle,
                })
            },
        )
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    async openSignMessage(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        message: Record<string, unknown>
        approvedAddresses: string[]
    }): Promise<{ signature: string } | null> {
        const approval: PendingApproval = { ...ctx, kind: 'sign-message' }
        // See openEnable's comment: finish() for this requestId only ever
        // passes a `{ signature }` shape (handleMessage's
        // 'resolve-sign-message' case) or null (window-close), so this cast
        // is safe.
        const decision = new Promise<{ signature: string } | null>(resolve => {
            this.pending.set(ctx.requestId, {
                approval,
                settle: resolve as Settle,
            })
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    // Shared by every open* method: every approval kind prefers the toolbar
    // popup (attached to the extension icon, no extra window chrome). The
    // popup gets no ?requestId, so it discovers the pending approval via
    // get-current-approval; the window fallback carries the id on its URL.
    private async openViaPopupOrWindow(requestId: string): Promise<void> {
        // Fall back to the dedicated window only if openPopup is unavailable
        // (older Chrome) or the browser refuses it (e.g. no user gesture).
        const usedPopup = await this.tryOpenActionPopup()
        const entry = this.pending.get(requestId)
        if (usedPopup) {
            if (entry) entry.surface = 'popup'
        } else {
            if (entry) entry.surface = 'window'
            await this.openApprovalWindow(requestId)
        }
    }

    // Opens the dedicated fallback window at approval.html and registers its
    // new windowId against the pending entry. Registration is synchronous on
    // the microtask after windows.create resolves — before any onRemoved can
    // fire — so a real user close always matches on windowToRequest and no
    // pre-registration stash is needed (or safe: a stashed id could be reused
    // by a later window and wrongly reject it).
    private async openApprovalWindow(requestId: string): Promise<void> {
        const before = this.pending.get(requestId)
        if (before) before.surface = 'window'
        const url = this.chromeLike.runtime.getURL(
            `approval.html?requestId=${encodeURIComponent(requestId)}`,
        )
        const win = await this.chromeLike.windows.create({
            url,
            type: 'popup',
            width: 360,
            height: 600,
            focused: true,
        })
        const entry = this.pending.get(requestId)
        if (entry && typeof win?.id === 'number') {
            entry.windowId = win.id
            this.windowToRequest.set(win.id, requestId)
        }
    }

    // Best-effort: chrome.action.openPopup requires a recent user gesture and
    // isn't available on older Chrome, so a rejection/absence is expected,
    // not exceptional — callers fall back to the dedicated window.
    private async tryOpenActionPopup(): Promise<boolean> {
        // Cast away the (options?, callback) overloads: chrome.action.openPopup
        // is a plain namespace function (no `this` binding), so TS's .call()
        // overload resolution otherwise picks the wrong arity.
        const openPopup = this.chromeLike.action?.openPopup as
            | (() => Promise<void>)
            | undefined
        if (!openPopup) return false
        try {
            await openPopup.call(this.chromeLike.action)
            return true
        } catch {
            return false
        }
    }

    private handleMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender | undefined,
        sendResponse: (r: unknown) => void,
    ): boolean => {
        const msg = message as {
            scope?: string
            kind?: string
            requestId?: string
            approvedAddresses?: string[]
            stxns?: (string | null)[]
            signature?: string
        }
        if (msg?.scope !== DAPP_APPROVAL_SCOPE) return false
        if (!isTrustedExtensionPageSender(sender, this.chromeLike)) {
            sendResponse({ ok: false, error: 'untrusted sender' })
            return true
        }
        if (msg.kind === 'get-current-approval') {
            // No requestId: the toolbar popup discovers whichever approval is
            // pending — enable OR sign (both now open in the toolbar popup).
            // Keep the most recently added if more than one is in flight (a
            // sign always follows a resolved enable, so in practice there's
            // exactly one).
            let current: PendingApproval | null = null
            for (const e of this.pending.values()) {
                current = e.approval
            }
            sendResponse(current)
            return true
        }
        const entry = msg.requestId
            ? this.pending.get(msg.requestId)
            : undefined
        if (!entry) {
            sendResponse({ ok: false, error: 'unknown request' })
            return true
        }
        switch (msg.kind) {
            case 'get-approval': {
                sendResponse(entry.approval)
                return true
            }
            case 'resolve-approval': {
                this.finish(msg.requestId!, {
                    approvedAddresses: msg.approvedAddresses ?? [],
                })
                sendResponse({ ok: true })
                return true
            }
            case 'resolve-sign-transactions': {
                this.finish(msg.requestId!, { stxns: msg.stxns ?? [] })
                sendResponse({ ok: true })
                return true
            }
            case 'resolve-sign-message': {
                this.finish(msg.requestId!, { signature: msg.signature ?? '' })
                sendResponse({ ok: true })
                return true
            }
            case 'reject-approval': {
                this.finish(msg.requestId!, null)
                sendResponse({ ok: true })
                return true
            }
            default: {
                sendResponse({ ok: false, error: 'unknown kind' })
                return true
            }
        }
    }

    private handleWindowRemoved = (windowId: number): void => {
        if (this.selfClosedWindowIds.delete(windowId)) {
            // We closed this window ourselves in finish(); not a user close.
            return
        }
        const requestId = this.windowToRequest.get(windowId)
        if (requestId) {
            this.finish(requestId, null) // closed = reject
        }
        // An unmatched id is a stale/foreign/reused window we don't track (the
        // toolbar popup's own internal window, or an id Chrome has since
        // reassigned). Ignore it: a genuine approval-window close always
        // matches windowToRequest, because openApprovalWindow registers the id
        // synchronously right after windows.create resolves — before any
        // onRemoved can fire. A pre-registration stash would let a foreign id
        // be reused by a later window and wrongly reject it.
    }

    private finish(requestId: string, decision: unknown): void {
        const entry = this.pending.get(requestId)
        if (!entry) return
        this.pending.delete(requestId)
        if (entry.surface === 'window' && typeof entry.windowId === 'number') {
            this.windowToRequest.delete(entry.windowId)
            this.selfClosedWindowIds.add(entry.windowId)
            // Best-effort close on programmatic resolve; ignore if already gone.
            void this.chromeLike.windows
                .remove?.(entry.windowId)
                .catch(() => {})
        }
        entry.settle(decision)
    }
}
