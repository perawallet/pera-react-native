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
// exposing chrome.action.openPopup, resolving or rejecting as requested;
// omitted entirely simulates older Chrome where chrome.action.openPopup
// doesn't exist.
const makeChrome = (
    idOverrides?: number[],
    actionOpenPopup?: 'resolve' | 'reject',
) => {
    let onMessage: Function = () => {}
    let onRemoved: Function = () => {}
    const created: any[] = []
    let nextWindowId = 100
    let idIndex = 0
    const openPopup = vi.fn(() =>
        actionOpenPopup === 'reject'
            ? Promise.reject(new Error('openPopup unavailable'))
            : Promise.resolve(undefined),
    )
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
})
