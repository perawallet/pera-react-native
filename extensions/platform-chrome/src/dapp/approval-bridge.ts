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

import { type SerializedCredential } from '@perawallet/wallet-core-passkeys/webauthn'
import { type Arc0027ApprovalOpener } from '@perawallet/wallet-core-arc0027'
import { isTrustedExtensionPageSender } from './../trusted-sender'
import {
    type PasskeyDecision,
    type PasskeyCreateApprovalContext,
    type PasskeyGetApprovalContext,
    type PasskeyApprovalOpener,
} from './passkey-opener'

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
    | {
          kind: 'wc-connect'
          requestId: string
          // dApp-asserted `peerMeta.url` origin — the WalletConnect
          // handshake's own claim, which a page can forge.
          origin: string
          faviconUrl?: string
          clientId: string
          chainId: number
          // dApp-asserted display metadata, for the same header mobile's
          // ConnectionView renders. Display only.
          peerName?: string
          peerIcons?: string[]
          permissions?: string[]
          // Browser-verified origin of the tab that requested this pairing
          // (see `WcControlMessage`'s `pair.requesterOrigin` doc comment).
          // Absent for user-initiated pairings. Never conflate with
          // `origin` above — different trust levels.
          requesterOrigin?: string
      }
    | {
          kind: 'wc-sign'
          requestId: string
          origin: string
          faviconUrl?: string
          clientId: string
          wcRequestId: number
          method: 'algo_signTxn' | 'algo_signData'
          payload: unknown
      }
    | {
          // Notification-only: a handshake the offscreen host already refused,
          // shown so the user learns why (see `WcApprovalRequestMessage`'s
          // `wc-error` doc comment). There is no decision to make — the
          // surface's single button just settles this entry so the window
          // closes, and the router discards whatever it settles with.
          kind: 'wc-error'
          requestId: string
          origin: string
          faviconUrl?: string
          clientId: string
          reason: 'network-mismatch'
          requestedChainId?: number
          activeNetwork: string
      }
    | ({
          kind: 'passkey-create'
          // Optional on every kind (see 'enable' above) so code that reads
          // it generically off a `PendingApproval | null` (no per-kind
          // narrowing) — e.g. useEnableRequestScreen — keeps type-checking
          // without every call site branching on `kind` first.
          faviconUrl?: string
      } & PasskeyCreateApprovalContext)
    | ({
          kind: 'passkey-get'
          faviconUrl?: string
      } & PasskeyGetApprovalContext)

// Each open* method creates its own typed Promise and stores its `resolve`
// here as this widened `Settle`; `finish()` stays generic over the decision
// shape so one pending map (and one window-lifecycle implementation) serves
// all approval kinds. The cast back to the caller's shape happens at each
// open* method's promise executor, not here.
type Settle = (decision: unknown) => void

export class ApprovalWindowBridge
    implements Arc0027ApprovalOpener, PasskeyApprovalOpener
{
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
    // Holds the requestId currently awaiting tryOpenActionPopup()'s result,
    // so a second request racing in during that gap also routes to the
    // window instead of contending for the same popup attempt. This is
    // DELIBERATELY separate from `surface: 'popup'` on the pending entry —
    // that field must only ever mean "the popup genuinely opened", since
    // get-current-approval trusts it to decide what to advertise. See
    // openViaPopupOrWindow.
    private popupAttemptRequestId: string | null = null

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
        const decision = this.awaitApproval<{ approvedAddresses: string[] }>({
            ...ctx,
            kind: 'enable',
        })
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
        const decision = this.awaitApproval<{ stxns: (string | null)[] }>({
            ...ctx,
            kind: 'sign-transactions',
        })
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
        const decision = this.awaitApproval<{ signature: string }>({
            ...ctx,
            kind: 'sign-message',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    async openWcConnect(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        clientId: string
        chainId: number
        peerName?: string
        peerIcons?: string[]
        permissions?: string[]
        requesterOrigin?: string
    }): Promise<{ approvedAddresses: string[] } | null> {
        const decision = this.awaitApproval<{ approvedAddresses: string[] }>({
            ...ctx,
            kind: 'wc-connect',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    async openWcSign(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        clientId: string
        wcRequestId: number
        method: 'algo_signTxn' | 'algo_signData'
        payload: unknown
    }): Promise<{ result: unknown } | null> {
        const decision = this.awaitApproval<{ result: unknown }>({
            ...ctx,
            kind: 'wc-sign',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    /**
     * Opens the notification-only WalletConnect error surface. Resolves when
     * the user acknowledges it (or the window closes), which is what the
     * caller uses to know the surface is gone — offscreen holds at most one
     * open at a time so a page cannot spam windows by repeatedly pairing on
     * the wrong network.
     */
    async openWcError(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        clientId: string
        reason: 'network-mismatch'
        requestedChainId?: number
        activeNetwork: string
    }): Promise<void> {
        const settled = this.awaitApproval<unknown>({
            ...ctx,
            kind: 'wc-error',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        await settled
    }

    async openPasskeyCreate(
        ctx: PasskeyCreateApprovalContext,
    ): Promise<PasskeyDecision> {
        const decision = this.awaitApproval<PasskeyDecision>({
            ...ctx,
            kind: 'passkey-create',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    async openPasskeyGet(
        ctx: PasskeyGetApprovalContext,
    ): Promise<PasskeyDecision> {
        const decision = this.awaitApproval<PasskeyDecision>({
            ...ctx,
            kind: 'passkey-get',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    // Shared by every open* method above: stores the pending approval and
    // returns the promise `finish()` settles. `finish()` is generic over the
    // decision shape (see the `Settle` comment), and for a given requestId it
    // is only ever called from the single handleMessage case (or window-close
    // path) matching that approval's `kind` — with the exact `T | null` shape
    // this method's caller declares — so the cast back to `T | null` is safe.
    private awaitApproval<T>(approval: PendingApproval): Promise<T | null> {
        return new Promise<T | null>(resolve => {
            this.pending.set(approval.requestId, {
                approval,
                settle: resolve as Settle,
            })
        })
    }

    // Shared by every open* method: every approval kind prefers the toolbar
    // popup (attached to the extension icon, no extra window chrome). The
    // popup gets no ?requestId, so it discovers the pending approval via
    // get-current-approval; the window fallback carries the id on its URL.
    private async openViaPopupOrWindow(requestId: string): Promise<void> {
        // At most one popup-surface approval may be in flight at a time —
        // get-current-approval has no requestId to disambiguate by, so a
        // second one would race the first for the popup. Route it straight
        // to the window instead. The reservation must cover BOTH a genuinely
        // popup-surfaced entry and an attempt still awaiting
        // tryOpenActionPopup's result (see popupAttemptRequestId), so a
        // second request racing in mid-attempt can't also try to open the
        // popup.
        const popupSlotTaken =
            [...this.pending.values()].some(e => e.surface === 'popup') ||
            this.popupAttemptRequestId !== null
        if (popupSlotTaken) {
            await this.openApprovalWindow(requestId)
            return
        }
        // Reserve the slot for the duration of the attempt WITHOUT marking
        // this entry's surface as 'popup' yet: chrome.action.openPopup()
        // only resolves once the toolbar popup has completed its first
        // load, and rejects if the popup is dismissed before that happens
        // — so until it resolves true there is no guarantee a popup exists
        // at all. Advertising 'popup' before that's known would let
        // get-current-approval report a toolbar popup that never opened.
        // `surface` only flips to 'popup' once tryOpenActionPopup has
        // genuinely resolved true, below.
        this.popupAttemptRequestId = requestId
        let usedPopup = false
        try {
            usedPopup = await this.tryOpenActionPopup()
        } finally {
            // Always release the reservation on every exit path (including a
            // throw from tryOpenActionPopup, which currently can't happen
            // since it catches internally, but must not silently leak the
            // reservation if that ever changes) — finish() also releases it
            // (see below) for the case where the approval settles while this
            // attempt is still unsettled.
            this.popupAttemptRequestId = null
        }
        if (usedPopup) {
            const entry = this.pending.get(requestId)
            if (entry) entry.surface = 'popup'
            return
        }
        // Fall back to the dedicated window only if openPopup is unavailable
        // (older Chrome) or tryOpenActionPopup's own await rejected/resolved
        // false — observed behaviour is that openPopup resolves once the
        // toolbar popup completes its first load and rejects if the popup is
        // dismissed before that, not that it requires a recent user gesture
        // (a reviewer called it from the service worker with no gesture at
        // all and it resolved).
        await this.openApprovalWindow(requestId)
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

    // Best-effort: chrome.action.openPopup isn't available on older Chrome,
    // and — per the observed behaviour documented on openViaPopupOrWindow's
    // reservation comment above — it rejects if the toolbar popup is
    // dismissed before completing its first load. Either way a
    // rejection/absence is expected, not exceptional — callers fall back to
    // the dedicated window.
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
            credential?: SerializedCredential
            reason?: string
            result?: unknown
        }
        if (msg?.scope !== DAPP_APPROVAL_SCOPE) return false
        if (!isTrustedExtensionPageSender(sender, this.chromeLike)) {
            sendResponse({ ok: false, error: 'untrusted sender' })
            return true
        }
        if (msg.kind === 'get-current-approval') {
            // No requestId: the toolbar popup discovers whichever approval is
            // pending. openViaPopupOrWindow guarantees at most one
            // popup-surface entry exists at a time, so this is unambiguous
            // — a concurrent request that got routed to the window instead
            // (surface: 'window') must be skipped here.
            let current: PendingApproval | null = null
            for (const e of this.pending.values()) {
                if (e.surface === 'popup') current = e.approval
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
            case 'resolve-wc-sign': {
                this.finish(msg.requestId!, { result: msg.result })
                sendResponse({ ok: true })
                return true
            }
            case 'reject-approval': {
                this.finish(msg.requestId!, null)
                sendResponse({ ok: true })
                return true
            }
            case 'resolve-passkey': {
                if (!msg.credential) {
                    sendResponse({ ok: false, error: 'missing credential' })
                    return true
                }
                this.finish(msg.requestId!, { credential: msg.credential })
                sendResponse({ ok: true })
                return true
            }
            case 'reject-passkey': {
                this.finish(msg.requestId!, {
                    error: msg.reason ?? 'declined',
                })
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
        // The approval can settle (e.g. a fast reject) while its own popup
        // attempt is still unsettled — release the reservation here too, not
        // just in openViaPopupOrWindow's `finally`, so it can't outlive the
        // approval it was reserved for.
        if (this.popupAttemptRequestId === requestId) {
            this.popupAttemptRequestId = null
        }
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
