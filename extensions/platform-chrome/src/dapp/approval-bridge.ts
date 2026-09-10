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

import type { SerializedCredential } from '@perawallet/wallet-core-passkeys/webauthn'
import type { Arc0027ApprovalOpener } from '@perawallet/wallet-core-arc0027'
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    ConnectionKind,
    ConnectionPeer,
} from '@perawallet/wallet-extension-connections'
import {
    isWireWalletOperationResult,
    type ConnectionErrorReason,
    type WireWalletOperation,
    type WireWalletOperationResult,
} from '../connections/protocol'
import { isTrustedExtensionPageSender } from './../trusted-sender'
import type {
    PasskeyDecision,
    PasskeyCreateApprovalContext,
    PasskeyGetApprovalContext,
    PasskeyApprovalOpener,
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
          kind: 'connection-proposal'
          requestId: string
          // dApp-asserted, derived from `peer.url`; display only.
          origin: string
          faviconUrl?: string
          proposalId: string
          connectionKind: ConnectionKind
          peer: ConnectionPeer
          requested: { networks: Network[]; methods: string[] }
          expiresAt: number
          // Browser-verified origin of the requesting tab; absent for a
          // user-initiated pairing. Never conflate with `origin` above.
          requesterOrigin?: string
      }
    | {
          kind: 'connection-request'
          requestId: string
          origin: string
          faviconUrl?: string
          connectionId: string
          correlationId: string
          operation: WireWalletOperation
          authorizedAccounts: string[]
          peer: ConnectionPeer
      }
    | {
          // Notification-only: the host already refused the peer. The surface's
          // single button settles this entry so the window closes.
          kind: 'connection-error'
          requestId: string
          origin: string
          faviconUrl?: string
          reason: ConnectionErrorReason
          peer?: ConnectionPeer
          activeNetwork?: Network
      }
    | ({
          kind: 'passkey-create'
          // Optional on every kind so generic readers of `PendingApproval | null`
          // type-check without narrowing on `kind` first.
          faviconUrl?: string
      } & PasskeyCreateApprovalContext)
    | ({
          kind: 'passkey-get'
          faviconUrl?: string
      } & PasskeyGetApprovalContext)

/**
 * `origin` is dApp-asserted on the connection kinds (it comes from `peer.url`),
 * so a page varying `peerMeta.url` per handshake would dodge the per-origin cap
 * entirely. The browser-verified origin is used wherever the kind carries one.
 */
const capacityKeyFor = (approval: PendingApproval): string =>
    ('requesterOrigin' in approval ? approval.requesterOrigin : undefined) ??
    approval.origin

// Each open* method stores its typed `resolve` widened to this so one pending
// map serves every approval kind; the cast back happens in that method's executor.
type Settle = (decision: unknown) => void

// Generous on purpose: a dApp has one approval in flight, and two tabs of the
// same site is the only ordinary reason to exceed it. Bounded by assertCapacity.
const MAX_PENDING_APPROVALS_PER_ORIGIN = 3
const MAX_PENDING_APPROVALS = 8

// How long a toolbar-popup approval may go unclaimed before it counts as dismissed:
// longer than first paint plus one round-trip, far shorter than a user deliberating.
const POPUP_CLAIM_TIMEOUT_MS = 5000

// `chrome.action.openPopup()` can neither resolve nor reject (no window manager:
// headless CI, a minimised browser). Awaited unbounded, the approval is stranded
// with no surface and the popup slot reserved for the worker's life. Sized above
// a cold popup boot so a slow-but-working popup is not pre-empted; a late resolve is ignored.
export const POPUP_OPEN_TIMEOUT_MS = 4000

// Which approval kinds each decision message may settle. `get-approval` and the
// universal rejects are omitted: valid for every kind.
const DECISION_KINDS: Record<string, readonly PendingApproval['kind'][]> = {
    'resolve-approval': ['enable', 'connection-proposal'],
    'resolve-sign-transactions': ['sign-transactions'],
    'resolve-sign-message': ['sign-message'],
    'resolve-connection-request': ['connection-request'],
    'resolve-passkey': ['passkey-create', 'passkey-get'],
    'reject-passkey': ['passkey-create', 'passkey-get'],
}

const isDecisionKindAllowed = (
    // Undefined reaches here from a malformed message; the switch below
    // answers those with 'unknown kind', so let them through unconstrained.
    messageKind: string | undefined,
    approvalKind: PendingApproval['kind'],
): boolean => {
    const allowed = messageKind ? DECISION_KINDS[messageKind] : undefined
    // Not a decision message (get-approval, reject-approval) — unconstrained.
    if (!allowed) return true
    return allowed.includes(approvalKind)
}

/** Callers surface this to the dApp as a declined request rather than opening a surface. */
export class ApprovalRejectedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ApprovalRejectedError'
    }
}

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
            // Set once the toolbar popup has fetched this approval via
            // get-current-approval — see the unclaimed sweep below.
            claimed?: boolean
            unclaimedTimer?: ReturnType<typeof setTimeout>
        }
    >()
    private readonly windowToRequest = new Map<number, string>()
    // Ids we are about to close ourselves via finish() -> windows.remove().
    // The resulting onRemoved must be ignored, not mistaken for a user close.
    private readonly selfClosedWindowIds = new Set<number>()
    // The requestId awaiting tryOpenActionPopup(), so a second request racing in
    // routes to the window. Deliberately separate from `surface: 'popup'`, which
    // must only ever mean the popup genuinely opened: get-current-approval trusts it.
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

    async openConnectionProposal(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        proposalId: string
        connectionKind: ConnectionKind
        peer: ConnectionPeer
        requested: { networks: Network[]; methods: string[] }
        expiresAt: number
        requesterOrigin?: string
    }): Promise<{ approvedAddresses: string[] } | null> {
        const decision = this.awaitApproval<{ approvedAddresses: string[] }>({
            ...ctx,
            kind: 'connection-proposal',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    async openConnectionRequest(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        connectionId: string
        correlationId: string
        operation: WireWalletOperation
        authorizedAccounts: string[]
        peer: ConnectionPeer
    }): Promise<{ result: WireWalletOperationResult } | null> {
        const decision = this.awaitApproval<{
            result: WireWalletOperationResult
        }>({
            ...ctx,
            kind: 'connection-request',
        })
        await this.openViaPopupOrWindow(ctx.requestId)
        return decision
    }

    /**
     * Resolves when the user dismisses the notice (or closes the window), so
     * the host can hold at most one error surface open at a time.
     */
    async openConnectionError(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        reason: ConnectionErrorReason
        peer?: ConnectionPeer
        activeNetwork?: Network
    }): Promise<void> {
        const settled = this.awaitApproval<unknown>({
            ...ctx,
            kind: 'connection-error',
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

    // `finish()` is only ever called for a requestId from the handleMessage case
    // (or window-close path) matching its kind, with the exact `T | null` the
    // caller declares, so the cast back is safe.
    private awaitApproval<T>(approval: PendingApproval): Promise<T | null> {
        // Overwriting a colliding requestId would strand the previous `settle`
        // forever; a peer retrying a correlation id reaches this. The ARC-0027
        // path is also guarded upstream by the router's in-flight map.
        const existing = this.pending.get(approval.requestId)
        if (existing) {
            throw new ApprovalRejectedError(
                `An approval for '${approval.requestId}' is already pending`,
            )
        }
        this.assertCapacity(capacityKeyFor(approval))
        return new Promise<T | null>(resolve => {
            this.pending.set(approval.requestId, {
                approval,
                settle: resolve as Settle,
            })
        })
    }

    // Every pending approval past the first becomes a real OS window, `enable`
    // needs no prior permission, and the core router only de-dupes on
    // `origin::requestId`, so a page varying the id could otherwise bury the
    // desktop in windows recoverable only by force-quitting the browser.
    private assertCapacity(key: string): void {
        if (this.pending.size >= MAX_PENDING_APPROVALS) {
            throw new ApprovalRejectedError(
                'Too many approval requests are already open',
            )
        }
        let forOrigin = 0
        for (const entry of this.pending.values()) {
            if (capacityKeyFor(entry.approval) === key) forOrigin++
        }
        if (forOrigin >= MAX_PENDING_APPROVALS_PER_ORIGIN) {
            throw new ApprovalRejectedError(
                `Too many approval requests are already open for ${key}`,
            )
        }
    }

    // Every kind prefers the toolbar popup. It gets no ?requestId and discovers the
    // approval via get-current-approval; the window fallback carries the id on its URL.
    private async openViaPopupOrWindow(requestId: string): Promise<void> {
        // get-current-approval has no requestId to disambiguate by, so at most one
        // popup-surface approval may be in flight; a second routes to the window.
        // Must also cover an attempt still awaiting tryOpenActionPopup (popupAttemptRequestId).
        const popupSlotTaken =
            [...this.pending.values()].some(e => e.surface === 'popup') ||
            this.popupAttemptRequestId !== null
        if (popupSlotTaken) {
            await this.openApprovalWindow(requestId)
            return
        }
        // Reserve the slot without marking `surface: 'popup'` yet: openPopup()
        // resolves only after the popup's first load and rejects if dismissed
        // before, so until then get-current-approval must not advertise a popup.
        this.popupAttemptRequestId = requestId
        let usedPopup = false
        try {
            usedPopup = await this.tryOpenActionPopup()
        } finally {
            // Released on every exit path; finish() also releases it for an
            // approval that settles while this attempt is still unsettled.
            this.popupAttemptRequestId = null
        }
        if (usedPopup) {
            const entry = this.pending.get(requestId)
            if (entry) {
                entry.surface = 'popup'
                // The toolbar popup emits no windows.onRemoved, so a dismissal
                // before the popup claims the approval would orphan the request and
                // burn the popup slot for the worker's life. Unclaimed settles as a rejection.
                entry.unclaimedTimer = setTimeout(() => {
                    if (this.pending.get(requestId) !== entry) return
                    if (entry.claimed) return
                    this.finish(requestId, null)
                }, POPUP_CLAIM_TIMEOUT_MS)
            }
            return
        }
        // openPopup needs no user gesture (it resolved when called from the SW
        // with none); a rejection means dismissed before first load, or an older
        // Chrome without it.
        await this.openApprovalWindow(requestId)
    }

    // The windowId is registered synchronously after windows.create resolves,
    // before any onRemoved can fire, so a real user close always matches
    // windowToRequest. A pre-registration stash would be unsafe: Chrome reuses ids.
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

    // Absent on older Chrome and rejects if the popup is dismissed before first
    // load; both are expected and callers fall back to the window. The timeout
    // covers the third outcome, never settling (see POPUP_OPEN_TIMEOUT_MS).
    private async tryOpenActionPopup(): Promise<boolean> {
        // Cast away the (options?, callback) overloads: chrome.action.openPopup
        // is a plain namespace function (no `this` binding), so TS's .call()
        // overload resolution otherwise picks the wrong arity.
        const openPopup = this.chromeLike.action?.openPopup as
            | (() => Promise<void>)
            | undefined
        if (!openPopup) return false
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            return await Promise.race([
                openPopup.call(this.chromeLike.action).then(() => true),
                new Promise<boolean>(resolve => {
                    timer = setTimeout(
                        () => resolve(false),
                        POPUP_OPEN_TIMEOUT_MS,
                    )
                }),
            ])
        } catch {
            return false
        } finally {
            // The loser of the race is abandoned, not cancelled: clear the timer
            // and let a late openPopup resolve into a promise nobody awaits.
            if (timer !== undefined) clearTimeout(timer)
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
            // No requestId: the popup takes whichever popup-surface approval is
            // pending (at most one exists); entries routed to the window must be skipped.
            let current: PendingApproval | null = null
            for (const e of this.pending.values()) {
                if (e.surface !== 'popup') continue
                current = e.approval
                // The popup is alive and has taken ownership — stand down the
                // unclaimed sweep armed in openViaPopupOrWindow.
                e.claimed = true
                if (e.unclaimedTimer !== undefined) {
                    clearTimeout(e.unclaimedTimer)
                    e.unclaimedTimer = undefined
                }
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
        // A `resolve-approval` against a `connection-request` would settle it with
        // `{approvedAddresses: []}` and the host would post a SUCCESSFUL response
        // with no signature; `Settle`'s widening hides this from the compiler.
        if (!isDecisionKindAllowed(msg.kind, entry.approval.kind)) {
            sendResponse({
                ok: false,
                error: `'${msg.kind}' cannot settle a '${entry.approval.kind}' approval`,
            })
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
            case 'resolve-connection-request': {
                if (!isWireWalletOperationResult(msg.result)) {
                    sendResponse({ ok: false, error: 'missing result' })
                    return true
                }
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
        // An unmatched id is a window we don't track (the popup's own, or one
        // Chrome reassigned); a genuine approval-window close always matches
        // because openApprovalWindow registers the id before any onRemoved can fire.
    }

    private finish(requestId: string, decision: unknown): void {
        const entry = this.pending.get(requestId)
        if (!entry) return
        this.pending.delete(requestId)
        // Settled by any route; the unclaimed timer has nothing left to guard.
        if (entry.unclaimedTimer !== undefined) {
            clearTimeout(entry.unclaimedTimer)
        }
        // An approval can settle while its own popup attempt is still unsettled;
        // release here too so the reservation can't outlive it.
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
