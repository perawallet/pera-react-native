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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApprovalWindowBridge, DAPP_APPROVAL_SCOPE } from '../approval-bridge'

// A chrome fake capturing windows.create + the two onMessage/onRemoved listeners.
// idOverrides lets a test force a specific sequence of window ids (e.g. to
// simulate Chrome reusing an id after a window fully closes), instead of the
// default ever-incrementing counter. `actionOpenPopup` opts the fake into
// exposing chrome.action.openPopup: 'resolve'/'reject' settle immediately;
// 'manual' returns a promise the test settles itself via the returned
// resolveOpenPopup/rejectOpenPopup, to observe the gap while the bridge is
// still awaiting tryOpenActionPopup. Omitted entirely simulates older Chrome
// where chrome.action.openPopup doesn't exist.
const makeChrome = (
    idOverrides?: number[],
    actionOpenPopup?: 'resolve' | 'reject' | 'manual',
) => {
    let onMessage: Function = () => {}
    let onRemoved: Function = () => {}
    const created: any[] = []
    let nextWindowId = 100
    let idIndex = 0
    let resolveOpenPopup: (() => void) | undefined
    let rejectOpenPopup: ((error: Error) => void) | undefined
    const openPopup = vi.fn(() => {
        if (actionOpenPopup === 'manual') {
            return new Promise<void>((resolve, reject) => {
                resolveOpenPopup = resolve
                rejectOpenPopup = reject
            })
        }
        return actionOpenPopup === 'reject'
            ? Promise.reject(new Error('openPopup unavailable'))
            : Promise.resolve(undefined)
    })
    return {
        chromeLike: {
            runtime: {
                id: 'ext-id',
                getURL: (p: string) => `chrome-extension://ext-id/${p}`,
                onMessage: { addListener: (fn: Function) => (onMessage = fn) },
            },
            windows: {
                create: vi.fn(async (opts: any) => {
                    created.push(opts)
                    const id = idOverrides
                        ? idOverrides[idIndex++]
                        : nextWindowId++
                    return { id }
                }),
                remove: vi.fn(async () => {}),
                onRemoved: { addListener: (fn: Function) => (onRemoved = fn) },
            },
            ...(actionOpenPopup ? { action: { openPopup } } : {}),
        } as unknown as typeof chrome,
        created,
        openPopup,
        resolveOpenPopup: () => resolveOpenPopup?.(),
        rejectOpenPopup: (error: Error) => rejectOpenPopup?.(error),
        fireMessage: (msg: unknown, sender: unknown) =>
            new Promise(resolve => onMessage(msg, sender, resolve)),
        closeWindow: (id: number) => onRemoved(id),
    }
}

// Flushes both the microtask queue and a macrotask tick — enough for the
// tryOpenActionPopup -> (fallback) openApprovalWindow -> windows.create
// chain to fully settle before assertions run.
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const trustedSender = {
    id: 'ext-id',
    url: 'chrome-extension://ext-id/approval.html',
}

describe('ApprovalWindowBridge', () => {
    it('opens a 360x600 popup at approval.html?requestId and resolves on approve', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openEnable({
            requestId: 'q1',
            origin: 'https://x.com',
        })
        // chrome.action is absent from this fake, so openEnable falls back
        // to the window path after the tryOpenActionPopup check settles.
        await flush()

        expect(created[0].type).toBe('popup')
        expect(created[0].width).toBe(360)
        expect(created[0].height).toBe(600)
        expect(created[0].url).toContain('approval.html?requestId=q1')

        // The window fetches its context (sender-gated).
        const ctx = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'q1',
            },
            trustedSender,
        )
        expect(ctx).toMatchObject({
            requestId: 'q1',
            origin: 'https://x.com',
            kind: 'enable',
        })

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'q1',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ approvedAddresses: ['A'] })
    })

    it('resolves null when the approval window is closed without a decision', async () => {
        const { chromeLike, closeWindow } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openEnable({
            requestId: 'q2',
            origin: 'https://y.com',
        })
        // No chrome.action in this fake → falls back to the window. flush()
        // drains tryOpenActionPopup -> openApprovalWindow so the window (id
        // 100) is registered before the close, exactly as in real Chrome
        // (onRemoved can only fire for an already-created, registered window).
        await flush()
        closeWindow(100)
        expect(await decision).toBeNull()
    })

    it('ignores resolve messages from an untrusted sender', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openEnable({
            requestId: 'q3',
            origin: 'https://z.com',
        })
        const ack = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'q3',
                approvedAddresses: ['A'],
            },
            { id: 'ext-id', url: 'https://evil.com/x' }, // page origin, not extension
        )
        expect(ack).toMatchObject({ ok: false })
        // decision stays pending; close it to avoid a dangling promise in the test
        // (assert it did NOT resolve to the injected addresses):
        let settled = false
        void decision.then(() => (settled = true))
        await Promise.resolve()
        expect(settled).toBe(false)
    })

    it('does not leak the closed window id after a completed approval (no cross-talk on window-id reuse)', async () => {
        // Chrome can hand out the same window id again once the previous
        // window is fully closed, so force id 100 to be reused for the
        // second popup.
        const { chromeLike, fireMessage, closeWindow } = makeChrome([100, 100])
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision1 = bridge.openEnable({
            requestId: 'q4',
            origin: 'https://a.com',
        })
        // Round-trip a get-approval first so the windowId registration
        // (which happens on the microtask after windows.create resolves)
        // has definitely landed before we resolve. flush() first drains the
        // tryOpenActionPopup -> openApprovalWindow fallback chain.
        await flush()
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'q4',
            },
            trustedSender,
        )
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'q4',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
        expect(await decision1).toEqual({ approvedAddresses: ['A'] })

        // Chrome now fires the genuine onRemoved for the window finish()
        // just closed itself. windowToRequest no longer has id 100, so this is
        // an unmatched removal and is ignored — it must not affect the reused
        // id for the next approval below.
        closeWindow(100)

        // A brand-new approval reuses window id 100. If the stale entry
        // leaked, registration would immediately (and wrongly) settle this
        // decision to null via the drain-on-registration path, before
        // anyone acted on it.
        const decision2 = bridge.openEnable({
            requestId: 'q5',
            origin: 'https://b.com',
        })
        await flush()
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'q5',
            },
            trustedSender,
        )
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'q5',
                approvedAddresses: ['B'],
            },
            trustedSender,
        )
        expect(await decision2).toEqual({ approvedAddresses: ['B'] })
    })

    it('openSignTransactions: falls back to the window (no action) and resolve returns stxns', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openSignTransactions({
            requestId: 's1',
            origin: 'https://x.com',
            txns: [{ txn: 'AAA' }],
            approvedAddresses: ['A'],
        })
        await flush()
        expect(created[0].url).toContain('approval.html?requestId=s1')
        const ctx = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 's1',
            },
            trustedSender,
        )
        expect(ctx).toMatchObject({
            kind: 'sign-transactions',
            txns: [{ txn: 'AAA' }],
            approvedAddresses: ['A'],
        })
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-transactions',
                requestId: 's1',
                stxns: ['SIGNED', null],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ stxns: ['SIGNED', null] })
    })

    it('resolves null when the sign-transactions fallback window is closed without a decision', async () => {
        const { chromeLike, closeWindow } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openSignTransactions({
            requestId: 's2',
            origin: 'https://y.com',
            txns: [],
            approvedAddresses: [],
        })
        await flush()
        closeWindow(100)
        expect(await decision).toBeNull()
    })

    it('ignores resolve-sign-transactions messages from an untrusted sender', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openSignTransactions({
            requestId: 's3',
            origin: 'https://z.com',
            txns: [],
            approvedAddresses: [],
        })
        const ack = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-transactions',
                requestId: 's3',
                stxns: ['SIGNED'],
            },
            { id: 'ext-id', url: 'https://evil.com/x' },
        )
        expect(ack).toMatchObject({ ok: false })
        let settled = false
        void decision.then(() => (settled = true))
        await Promise.resolve()
        expect(settled).toBe(false)
    })

    it('openSignMessage: falls back to the window (no action) and resolve returns signature', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openSignMessage({
            requestId: 'm1',
            origin: 'https://x.com',
            message: { data: 'AAA' },
            approvedAddresses: ['A'],
        })
        await flush()
        expect(created[0].url).toContain('approval.html?requestId=m1')
        const ctx = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'm1',
            },
            trustedSender,
        )
        expect(ctx).toMatchObject({
            kind: 'sign-message',
            message: { data: 'AAA' },
            approvedAddresses: ['A'],
        })
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-message',
                requestId: 'm1',
                signature: 'SIG',
            },
            trustedSender,
        )
        expect(await decision).toEqual({ signature: 'SIG' })
    })

    it('resolves null when the sign-message fallback window is closed without a decision', async () => {
        const { chromeLike, closeWindow } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openSignMessage({
            requestId: 'm2',
            origin: 'https://y.com',
            message: {},
            approvedAddresses: [],
        })
        await flush()
        closeWindow(100)
        expect(await decision).toBeNull()
    })

    it('ignores resolve-sign-message messages from an untrusted sender', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openSignMessage({
            requestId: 'm3',
            origin: 'https://z.com',
            message: {},
            approvedAddresses: [],
        })
        const ack = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-message',
                requestId: 'm3',
                signature: 'SIG',
            },
            { id: 'ext-id', url: 'https://evil.com/x' },
        )
        expect(ack).toMatchObject({ ok: false })
        let settled = false
        void decision.then(() => (settled = true))
        await Promise.resolve()
        expect(settled).toBe(false)
    })

    it('openEnable: opens the toolbar popup via chrome.action.openPopup and never creates a window', async () => {
        const { chromeLike, created, openPopup, fireMessage } = makeChrome(
            undefined,
            'resolve',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openEnable({
            requestId: 'p1',
            origin: 'https://x.com',
        })

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'p1',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ approvedAddresses: ['A'] })
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(0)
    })

    it('openEnable: falls back to windows.create when chrome.action.openPopup rejects', async () => {
        const { chromeLike, created, openPopup, fireMessage } = makeChrome(
            undefined,
            'reject',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openEnable({
            requestId: 'p2',
            origin: 'https://x.com',
        })
        await flush()

        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(1)
        expect(created[0].url).toContain('approval.html?requestId=p2')

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'p2',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ approvedAddresses: ['A'] })
    })

    it('openEnable: falls back to windows.create when chrome.action is absent', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openEnable({
            requestId: 'p3',
            origin: 'https://x.com',
        })
        await flush()

        expect(created.length).toBe(1)
        expect(created[0].url).toContain('approval.html?requestId=p3')

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'reject-approval',
                requestId: 'p3',
            },
            trustedSender,
        )
        expect(await decision).toBeNull()
    })

    it('openSignTransactions: opens the toolbar popup via chrome.action.openPopup and never creates a window', async () => {
        const { chromeLike, created, openPopup, fireMessage } = makeChrome(
            undefined,
            'resolve',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openSignTransactions({
            requestId: 's4',
            origin: 'https://x.com',
            txns: [],
            approvedAddresses: [],
        })
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-transactions',
                requestId: 's4',
                stxns: ['SIGNED'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ stxns: ['SIGNED'] })
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(0)
    })

    it('openSignMessage: opens the toolbar popup via chrome.action.openPopup and never creates a window', async () => {
        const { chromeLike, created, openPopup, fireMessage } = makeChrome(
            undefined,
            'resolve',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openSignMessage({
            requestId: 'm4',
            origin: 'https://x.com',
            message: {},
            approvedAddresses: [],
        })
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-message',
                requestId: 'm4',
                signature: 'SIG',
            },
            trustedSender,
        )
        expect(await decision).toEqual({ signature: 'SIG' })
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(0)
    })

    it('a foreign window close during a fallback sign-window create does not reject it (no stale-id reuse)', async () => {
        // No chrome.action → sign falls back to a window, which Chrome assigns
        // id 300. A foreign window (e.g. a just-closed popup) is removed with
        // that same, soon-to-be-reused id while windows.create is still in
        // flight — the exact race the old removedBeforeRegistered stash turned
        // into a spurious cancel (the real-dapp "sign window instantly closes"
        // bug). With the stash gone, the unmatched removal is ignored.
        const { chromeLike, fireMessage, closeWindow } = makeChrome([300])
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openSignTransactions({
            requestId: 's9',
            origin: 'https://x.com',
            txns: [{}],
            approvedAddresses: ['A'],
        })
        // Before create resolves and registers id 300, the foreign id 300 is
        // removed.
        closeWindow(300)
        await flush()

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-transactions',
                requestId: 's9',
                stxns: ['SIGNED'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ stxns: ['SIGNED'] })
    })

    it('get-current-approval returns the pending enable approval; untrusted sender gets {ok:false}', async () => {
        const { chromeLike, fireMessage } = makeChrome(undefined, 'resolve')
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openEnable({
            requestId: 'p4',
            origin: 'https://current.com',
        })
        // The popup only genuinely opens (and only then advertises
        // surface: 'popup') after tryOpenActionPopup resolves — flush lets
        // that happen before asserting get-current-approval sees it.
        await flush()

        const current = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            trustedSender,
        )
        expect(current).toMatchObject({
            kind: 'enable',
            requestId: 'p4',
            origin: 'https://current.com',
        })

        const untrusted = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            { id: 'ext-id', url: 'https://evil.com/x' },
        )
        expect(untrusted).toMatchObject({ ok: false })
    })

    it('get-current-approval also returns a pending sign-transactions approval (sign opens in the toolbar popup too)', async () => {
        const { chromeLike, fireMessage } = makeChrome(undefined, 'resolve')
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openSignTransactions({
            requestId: 's7',
            origin: 'https://sign.com',
            txns: [{ txn: 'AAA' }],
            approvedAddresses: ['A'],
        })
        // See the flush() comment in the previous test — surface only
        // becomes 'popup' once tryOpenActionPopup genuinely resolves true.
        await flush()

        const current = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            trustedSender,
        )
        expect(current).toMatchObject({
            kind: 'sign-transactions',
            requestId: 's7',
            origin: 'https://sign.com',
        })
    })

    it('get-current-approval returns nothing while the popup attempt is still pending (no false advertisement before openPopup settles)', async () => {
        const { chromeLike, fireMessage, resolveOpenPopup } = makeChrome(
            undefined,
            'manual',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openEnable({
            requestId: 'gap-1',
            origin: 'https://gap.com',
        })
        // Let openViaPopupOrWindow run up to (and start) its await on
        // tryOpenActionPopup, whose promise is still unsettled in 'manual'
        // mode — this is the exact window Finding 1 was about.
        await Promise.resolve()
        await Promise.resolve()

        const current = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            trustedSender,
        )
        expect(current).toBeNull()

        // Let the attempt resolve so it doesn't dangle past the test.
        resolveOpenPopup()
        await flush()
    })

    it('get-current-approval returns the approval once the popup genuinely opened', async () => {
        const { chromeLike, fireMessage, resolveOpenPopup } = makeChrome(
            undefined,
            'manual',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openEnable({
            requestId: 'gap-2',
            origin: 'https://gap.com',
        })
        await Promise.resolve()
        await Promise.resolve()

        resolveOpenPopup()
        await flush()

        const current = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            trustedSender,
        )
        expect(current).toMatchObject({ kind: 'enable', requestId: 'gap-2' })
    })

    it('get-current-approval does not return the approval when the popup attempt failed and the window fallback was used', async () => {
        const { chromeLike, fireMessage, rejectOpenPopup } = makeChrome(
            undefined,
            'manual',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openEnable({
            requestId: 'gap-3',
            origin: 'https://gap.com',
        })
        await Promise.resolve()
        await Promise.resolve()

        rejectOpenPopup(new Error('no user gesture'))
        await flush()

        const current = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            trustedSender,
        )
        expect(current).toBeNull()
    })

    it('openPasskeyCreate: falls back to the window and resolve-passkey returns the credential', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openPasskeyCreate({
            requestId: 'pkc1',
            origin: 'https://webauthn.io',
            rpId: 'webauthn.io',
            userName: 'alice',
            options: { rp: { id: 'webauthn.io' } } as any,
        })
        await flush()
        expect(created[0].url).toContain('approval.html?requestId=pkc1')
        const ctx = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'pkc1',
            },
            trustedSender,
        )
        expect(ctx).toMatchObject({
            kind: 'passkey-create',
            rpId: 'webauthn.io',
            userName: 'alice',
        })
        const CREDENTIAL = { id: 'cred', rawId: 'cred', type: 'public-key' }
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-passkey',
                requestId: 'pkc1',
                credential: CREDENTIAL,
            },
            trustedSender,
        )
        expect(await decision).toEqual({ credential: CREDENTIAL })
    })

    it('openPasskeyCreate: resolves null when the window is closed without a decision', async () => {
        const { chromeLike, closeWindow } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openPasskeyCreate({
            requestId: 'pkc2',
            origin: 'https://webauthn.io',
            rpId: 'webauthn.io',
            options: {} as any,
        })
        await flush()
        closeWindow(100)
        expect(await decision).toBeNull()
    })

    it('reject-passkey settles with the given reason', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openPasskeyCreate({
            requestId: 'pkc3',
            origin: 'https://webauthn.io',
            rpId: 'webauthn.io',
            options: {} as any,
        })
        await flush()
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'reject-passkey',
                requestId: 'pkc3',
                reason: 'declined',
            },
            trustedSender,
        )
        expect(await decision).toEqual({ error: 'declined' })
    })

    it('ignores resolve-passkey messages from an untrusted sender', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openPasskeyCreate({
            requestId: 'pkc4',
            origin: 'https://webauthn.io',
            rpId: 'webauthn.io',
            options: {} as any,
        })
        const ack = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-passkey',
                requestId: 'pkc4',
                credential: { id: 'x' },
            },
            { id: 'ext-id', url: 'https://evil.com/x' },
        )
        expect(ack).toMatchObject({ ok: false })
        let settled = false
        void decision.then(() => (settled = true))
        await Promise.resolve()
        expect(settled).toBe(false)
    })

    it('openPasskeyGet: falls back to the window and resolve-passkey returns the credential', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openPasskeyGet({
            requestId: 'pkg1',
            origin: 'https://webauthn.io',
            rpId: 'webauthn.io',
            options: {} as any,
        })
        await flush()
        expect(created[0].url).toContain('approval.html?requestId=pkg1')
        const ctx = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'pkg1',
            },
            trustedSender,
        )
        expect(ctx).toMatchObject({ kind: 'passkey-get', rpId: 'webauthn.io' })
        const CREDENTIAL = { id: 'cred2', rawId: 'cred2', type: 'public-key' }
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-passkey',
                requestId: 'pkg1',
                credential: CREDENTIAL,
            },
            trustedSender,
        )
        expect(await decision).toEqual({ credential: CREDENTIAL })
    })

    it('reject-passkey with no reason defaults to "declined"', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()
        const decision = bridge.openPasskeyGet({
            requestId: 'pkg2',
            origin: 'https://webauthn.io',
            rpId: 'webauthn.io',
            options: {} as any,
        })
        await flush()
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'reject-passkey',
                requestId: 'pkg2',
            },
            trustedSender,
        )
        expect(await decision).toEqual({ error: 'declined' })
    })

    it('routes a second concurrent request to the window while a popup-surface approval is in flight, and clears once that approval settles', async () => {
        const { chromeLike, created, openPopup, fireMessage } = makeChrome(
            undefined,
            'resolve',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        // A opens via the popup path.
        const decisionA = bridge.openEnable({
            requestId: 'race-a',
            origin: 'https://a.com',
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(0)

        // B arrives from a different origin while A is still pending — it
        // must not contend for the popup.
        const decisionB = bridge.openSignTransactions({
            requestId: 'race-b',
            origin: 'https://b.com',
            txns: [{}],
            approvedAddresses: ['B'],
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(1)
        expect(created[0].url).toContain('approval.html?requestId=race-b')

        // get-current-approval (the popup's own lookup) must still resolve
        // to A, not the window-bound B.
        const current = await fireMessage(
            { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
            trustedSender,
        )
        expect(current).toMatchObject({ kind: 'enable', requestId: 'race-a' })

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'race-a',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
        expect(await decisionA).toEqual({ approvedAddresses: ['A'] })

        // A has settled, so the popup path is free again for a new request.
        const decisionC = bridge.openEnable({
            requestId: 'race-c',
            origin: 'https://c.com',
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(2)
        expect(created.length).toBe(1)

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-transactions',
                requestId: 'race-b',
                stxns: ['SIGNED'],
            },
            trustedSender,
        )
        expect(await decisionB).toEqual({ stxns: ['SIGNED'] })

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'race-c',
                approvedAddresses: ['C'],
            },
            trustedSender,
        )
        expect(await decisionC).toEqual({ approvedAddresses: ['C'] })
    })

    it('finish() releases the popup-attempt reservation when the approval settles while the attempt is still unsettled (no permanent leak)', async () => {
        // 'manual' mode leaves tryOpenActionPopup's promise unsettled — the
        // exact gap Finding 1 is about: before the fix, the reservation was
        // only cleared on the line AFTER that await, so resolving the
        // approval out of `pending` via a completely different path (here,
        // reject-approval) while the attempt is still in flight left it
        // stuck forever, forcing every later approval to the window.
        //
        // `void`, not `const decision = ...`: openEnable's own returned
        // promise doesn't settle until ITS tryOpenActionPopup await
        // resolves, which this test deliberately never does (that promise
        // has no observable effect on the reservation once finish() below
        // has already run) — awaiting it here would hang the test.
        const { chromeLike, openPopup, fireMessage } = makeChrome(
            undefined,
            'manual',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openEnable({
            requestId: 'leak-a',
            origin: 'https://a.com',
        })
        await Promise.resolve()
        await Promise.resolve()
        expect(openPopup).toHaveBeenCalledTimes(1)

        const ack = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'reject-approval',
                requestId: 'leak-a',
            },
            trustedSender,
        )
        expect(ack).toMatchObject({ ok: true })

        // A fresh request, issued WHILE A's own tryOpenActionPopup promise
        // is still unsettled, must be free to try the popup itself — if the
        // reservation leaked, this would be forced straight to the window
        // and openPopup would never be called for it.
        void bridge.openSignTransactions({
            requestId: 'leak-b',
            origin: 'https://b.com',
            txns: [],
            approvedAddresses: [],
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(2)
    })

    it('releases the popup-attempt reservation once tryOpenActionPopup genuinely settles, even when it falls back to the window', async () => {
        const { chromeLike, created, openPopup } = makeChrome(
            undefined,
            'reject',
        )
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        // A's attempt settles (openPopup rejects, falls back to the window)
        // and the `finally` around tryOpenActionPopup's await clears the
        // reservation as part of that.
        void bridge.openEnable({
            requestId: 'rel-a',
            origin: 'https://a.com',
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(1)

        // B arrives only once A's attempt has fully settled (not
        // concurrently) — it must still be free to try the popup itself.
        void bridge.openSignTransactions({
            requestId: 'rel-b',
            origin: 'https://b.com',
            txns: [],
            approvedAddresses: [],
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(2)
        expect(created.length).toBe(2)
    })

    it('routes a second request to the window while the first popup attempt is still unsettled, without a second openPopup call', async () => {
        // 'manual' mode leaves tryOpenActionPopup's promise unsettled until
        // the test explicitly resolves it — this is the exact gap Finding 1
        // (popupAttemptRequestId) exists to cover: at this point A has no
        // `surface: 'popup'` yet (that only gets set AFTER tryOpenActionPopup
        // resolves true), so the OLD `some(e => e.surface === 'popup')` check
        // alone would see the popup slot as free.
        const {
            chromeLike,
            created,
            openPopup,
            resolveOpenPopup,
            fireMessage,
        } = makeChrome(undefined, 'manual')
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        void bridge.openEnable({
            requestId: 'mid-a',
            origin: 'https://a.com',
        })
        // Let A's openViaPopupOrWindow run up to (and start) its await on
        // tryOpenActionPopup.
        await Promise.resolve()
        await Promise.resolve()
        expect(openPopup).toHaveBeenCalledTimes(1)

        // B arrives while A's attempt is still pending — it must route
        // straight to its own window instead of calling openPopup again.
        const decisionB = bridge.openSignTransactions({
            requestId: 'mid-b',
            origin: 'https://b.com',
            txns: [{}],
            approvedAddresses: ['B'],
        })
        await flush()
        expect(openPopup).toHaveBeenCalledTimes(1)
        expect(created.length).toBe(1)
        expect(created[0].url).toContain('approval.html?requestId=mid-b')

        // Let A's attempt settle and resolve both requests so nothing is
        // left dangling past the test.
        resolveOpenPopup()
        await flush()
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-sign-transactions',
                requestId: 'mid-b',
                stxns: ['SIGNED'],
            },
            trustedSender,
        )
        expect(await decisionB).toEqual({ stxns: ['SIGNED'] })
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'mid-a',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
    })

    it('finish() does not call windows.remove for a popup-surface enable resolved via resolve-approval', async () => {
        const { chromeLike, fireMessage } = makeChrome(undefined, 'resolve')
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openEnable({
            requestId: 'p5',
            origin: 'https://x.com',
        })
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'p5',
                approvedAddresses: ['A'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ approvedAddresses: ['A'] })
        expect(chromeLike.windows.remove).not.toHaveBeenCalled()
    })

    it('opens a wc-connect approval and resolves with the approved addresses', async () => {
        const { chromeLike, created, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openWcConnect({
            requestId: 'req-wc-1',
            origin: 'https://dapp.example',
            clientId: 'client-1',
            chainId: 416001,
        })
        await flush()
        expect(created[0].url).toContain('approval.html?requestId=req-wc-1')

        const approval = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'get-approval',
                requestId: 'req-wc-1',
            },
            trustedSender,
        )
        expect(approval).toMatchObject({
            kind: 'wc-connect',
            clientId: 'client-1',
            chainId: 416001,
        })

        // A wc-connect decision settles through the SAME generic
        // resolve-approval message every other approval kind uses
        // (EnableRequestScreen → useDappRequest.approve → resolveApproval)
        // — there is no dedicated wc-connect resolver.
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'req-wc-1',
                approvedAddresses: ['AAAA'],
            },
            trustedSender,
        )

        expect(await decision).toEqual({ approvedAddresses: ['AAAA'] })
    })

    it('opens a wc-sign approval and resolves with the signed result', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openWcSign({
            requestId: 'req-wc-2',
            origin: 'https://dapp.example',
            clientId: 'client-1',
            wcRequestId: 42,
            method: 'algo_signTxn',
            payload: { id: 42, params: [[{ txn: 'dHhu' }]] },
        })
        await flush()

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-wc-sign',
                requestId: 'req-wc-2',
                result: ['c3R4bg=='],
            },
            trustedSender,
        )

        expect(await decision).toEqual({ result: ['c3R4bg=='] })
    })

    it('rejects a wc-sign approval when its window is closed by the user', async () => {
        const { chromeLike, closeWindow } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openWcSign({
            requestId: 'req-wc-3',
            origin: 'https://dapp.example',
            clientId: 'client-1',
            wcRequestId: 43,
            method: 'algo_signTxn',
            payload: { id: 43, params: [[{ txn: 'dHhu' }]] },
        })
        await flush()
        closeWindow(100)

        expect(await decision).toBeNull()
    })

    // Every pending approval past the first becomes a real OS window, and
    // `enable` needs no prior permission — so without a cap a page that varies
    // the request id could bury the desktop with a loop of a few hundred.
    describe('capacity limits', () => {
        const openEnableFrom = (
            bridge: ApprovalWindowBridge,
            origin: string,
            requestId: string,
        ): Promise<unknown> =>
            bridge
                .openEnable({ requestId, origin })
                // Each rejection is asserted via the returned value; catching
                // here keeps an expected rejection from failing the run as an
                // unhandled one.
                .catch((error: unknown) => error)

        it('refuses more than three concurrent approvals for one origin', async () => {
            const { chromeLike, created } = makeChrome()
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            for (let i = 0; i < 3; i++) {
                void openEnableFrom(bridge, 'https://spam.example', `q${i}`)
                await flush()
            }
            expect(created).toHaveLength(3)

            const fourth = await openEnableFrom(
                bridge,
                'https://spam.example',
                'q3',
            )
            await flush()

            expect(fourth).toBeInstanceOf(Error)
            expect((fourth as Error).name).toBe('ApprovalRejectedError')
            // The point of the cap: no additional window was opened.
            expect(created).toHaveLength(3)
        })

        it('still admits a different origin once one origin is at its limit', async () => {
            const { chromeLike, created } = makeChrome()
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            for (let i = 0; i < 3; i++) {
                void openEnableFrom(bridge, 'https://spam.example', `q${i}`)
                await flush()
            }

            void openEnableFrom(bridge, 'https://other.example', 'other-1')
            await flush()

            expect(created).toHaveLength(4)
        })

        it('caps the total across origins', async () => {
            const { chromeLike, created } = makeChrome()
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            // 3 origins x 3 each would be 9; the global cap of 8 bites first.
            for (const origin of ['a', 'b', 'c']) {
                for (let i = 0; i < 3; i++) {
                    void openEnableFrom(
                        bridge,
                        `https://${origin}.example`,
                        `${origin}-${i}`,
                    )
                    await flush()
                }
            }

            expect(created).toHaveLength(8)
        })

        it('frees capacity once an approval settles', async () => {
            const { chromeLike, created, closeWindow } = makeChrome()
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            for (let i = 0; i < 3; i++) {
                void openEnableFrom(bridge, 'https://spam.example', `q${i}`)
                await flush()
            }
            expect(created).toHaveLength(3)
            closeWindow(100) // user dismisses the first

            // Not awaited: a successfully registered approval stays pending
            // until the user decides. The new window is the evidence it was
            // admitted rather than refused.
            void openEnableFrom(bridge, 'https://spam.example', 'q-next')
            await flush()

            expect(created).toHaveLength(4)
        })

        // Overwriting left the previous `settle` unreachable, so the request it
        // belonged to was answered by nobody for the life of the worker.
        it('refuses a requestId that is already pending instead of orphaning it', async () => {
            const { chromeLike, created, closeWindow } = makeChrome()
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            const first = bridge.openEnable({
                requestId: 'dupe',
                origin: 'https://x.com',
            })
            await flush()

            const second = await openEnableFrom(bridge, 'https://x.com', 'dupe')
            await flush()

            expect(second).toBeInstanceOf(Error)
            expect((second as Error).name).toBe('ApprovalRejectedError')
            expect(created).toHaveLength(1)

            // The original entry survived the collision and still settles.
            closeWindow(100)
            expect(await first).toBeNull()
        })
    })
})

// A decision message settles whatever requestId it names. Without a kind
// check, a `resolve-approval` carrying a wc-sign requestId resolved that
// promise with `{approvedAddresses: []}`, and the WC router then posted a
// SUCCESSFUL algo_signTxn response whose result was undefined.
describe('decision/approval kind matching', () => {
    it('refuses a decision that cannot settle the pending approval', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openWcSign({
            requestId: 'req-mismatch',
            origin: 'https://dapp.example',
            clientId: 'client-1',
            wcRequestId: 7,
            method: 'algo_signTxn',
            payload: {},
        })
        await flush()

        const res = await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'req-mismatch',
                approvedAddresses: [],
            },
            trustedSender,
        )

        expect(res).toEqual({
            ok: false,
            error: "'resolve-approval' cannot settle a 'wc-sign' approval",
        })

        // The approval is untouched and still settles correctly on its own
        // decision message.
        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-wc-sign',
                requestId: 'req-mismatch',
                result: ['signed'],
            },
            trustedSender,
        )
        expect(await decision).toEqual({ result: ['signed'] })
    })

    it('still allows a decision valid for the approval kind', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openEnable({
            requestId: 'req-enable',
            origin: 'https://dapp.example',
        })
        await flush()

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'resolve-approval',
                requestId: 'req-enable',
                approvedAddresses: ['ADDR'],
            },
            trustedSender,
        )

        expect(await decision).toEqual({ approvedAddresses: ['ADDR'] })
    })

    // reject-approval and the window-close path are universal by design.
    it('lets reject-approval settle any kind', async () => {
        const { chromeLike, fireMessage } = makeChrome()
        const bridge = new ApprovalWindowBridge(chromeLike)
        bridge.listen()

        const decision = bridge.openWcSign({
            requestId: 'req-any',
            origin: 'https://dapp.example',
            clientId: 'client-1',
            wcRequestId: 8,
            method: 'algo_signTxn',
            payload: {},
        })
        await flush()

        await fireMessage(
            {
                scope: DAPP_APPROVAL_SCOPE,
                kind: 'reject-approval',
                requestId: 'req-any',
            },
            trustedSender,
        )

        expect(await decision).toBeNull()
    })
})

// The toolbar popup emits no windows.onRemoved, so nothing observes a user
// dismissing it before its get-current-approval round-trip lands. That left
// the entry pending forever AND burned the single popup slot, forcing every
// later approval in the worker's life into a separate window.
describe('unclaimed toolbar-popup approvals', () => {
    it('settles as a rejection when the popup never claims it', async () => {
        vi.useFakeTimers()
        try {
            const { chromeLike } = makeChrome(undefined, 'resolve')
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            const decision = bridge.openEnable({
                requestId: 'unclaimed',
                origin: 'https://x.com',
            })
            await vi.advanceTimersByTimeAsync(0)
            await vi.advanceTimersByTimeAsync(6000)

            expect(await decision).toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })

    it('frees the popup slot so the next approval can use it again', async () => {
        vi.useFakeTimers()
        try {
            const { chromeLike, created, openPopup } = makeChrome(
                undefined,
                'resolve',
            )
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            void bridge.openEnable({
                requestId: 'first',
                origin: 'https://x.com',
            })
            await vi.advanceTimersByTimeAsync(0)
            expect(openPopup).toHaveBeenCalledTimes(1)
            expect(created).toHaveLength(0) // took the popup slot

            await vi.advanceTimersByTimeAsync(6000) // dismissed, never claimed

            void bridge.openEnable({
                requestId: 'second',
                origin: 'https://x.com',
            })
            await vi.advanceTimersByTimeAsync(0)

            // Slot released, so this one gets the popup too rather than
            // being forced into a window.
            expect(openPopup).toHaveBeenCalledTimes(2)
            expect(created).toHaveLength(0)
        } finally {
            vi.useRealTimers()
        }
    })

    it('leaves a claimed approval pending for the user to decide', async () => {
        vi.useFakeTimers()
        try {
            const { chromeLike, fireMessage } = makeChrome(undefined, 'resolve')
            const bridge = new ApprovalWindowBridge(chromeLike)
            bridge.listen()

            const decision = bridge.openEnable({
                requestId: 'claimed',
                origin: 'https://x.com',
            })
            await vi.advanceTimersByTimeAsync(0)

            // The popup fetches it — this is the claim.
            await fireMessage(
                { scope: DAPP_APPROVAL_SCOPE, kind: 'get-current-approval' },
                trustedSender,
            )
            await vi.advanceTimersByTimeAsync(60_000)

            let settled = false
            void decision.then(() => (settled = true))
            await Promise.resolve()
            expect(settled).toBe(false)
        } finally {
            vi.useRealTimers()
        }
    })
})
