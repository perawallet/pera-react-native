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

import { describe, it, expect, vi } from 'vitest'
import { PasskeyRouter } from '../passkey-router'
import { WEBAUTHN_RELAY_SCOPE } from '../webauthn-router-protocol'

const CREATE_OPTIONS = {
    rp: { name: 'Example' },
    user: { id: 'dXNlcg', name: 'alice', displayName: 'Alice' },
    challenge: 'Y2hhbGxlbmdl',
    pubKeyCredParams: [{ type: 'public-key' as const, alg: -7 }],
}

const GET_OPTIONS = {
    challenge: 'Y2hhbGxlbmdl',
}

const senderFor = (origin: string): chrome.runtime.MessageSender =>
    ({ origin, url: `${origin}/app`, tab: { id: 7 } }) as never

const call = (router: PasskeyRouter, message: unknown, origin: string) =>
    new Promise<any>(resolve => {
        const kept = router.handleMessage(message, senderFor(origin), resolve)
        expect(kept).toBe(true)
    })

const setup = (createDecision: unknown = null, getDecision: unknown = null) => {
    const openPasskeyCreate = vi.fn(async () => createDecision)
    const openPasskeyGet = vi.fn(async () => getDecision)
    const router = new PasskeyRouter({
        openEnable: vi.fn(),
        openSignTransactions: vi.fn(),
        openSignMessage: vi.fn(),
        openPasskeyCreate,
        openPasskeyGet,
    } as never)
    return { router, openPasskeyCreate, openPasskeyGet }
}

describe('PasskeyRouter', () => {
    it('ignores non-webauthn-relay messages (returns false)', () => {
        const { router } = setup()
        const kept = router.handleMessage(
            { scope: 'other' },
            senderFor('https://x.com'),
            vi.fn(),
        )
        expect(kept).toBe(false)
    })

    it('declines a sender with no trustworthy origin (opaque/file/extension)', async () => {
        const { router, openPasskeyCreate } = setup()
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://evil.com',
                    options: CREATE_OPTIONS,
                },
            },
            'null',
        )
        expect(res).toEqual({ decline: true })
        expect(openPasskeyCreate).not.toHaveBeenCalled()
    })

    it('stamps PendingApproval.origin from sender.origin, never the page-asserted request.origin', async () => {
        const { router, openPasskeyCreate } = setup({
            credential: {
                id: 'cred',
                rawId: 'cred',
                type: 'public-key',
                response: {},
            },
        })
        await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                // A spoofed/mismatched origin field in the request body must
                // be ignored entirely — the real trust anchor is sender.origin.
                request: {
                    kind: 'create',
                    origin: 'https://attacker.example',
                    options: CREATE_OPTIONS,
                },
            },
            'https://webauthn.io',
        )
        expect(openPasskeyCreate).toHaveBeenCalledTimes(1)
        const ctx = openPasskeyCreate.mock.calls[0][0]
        expect(ctx.origin).toBe('https://webauthn.io')
        expect(ctx.rpId).toBe('webauthn.io')
    })

    it('resolves rpId from options.rp.id for create and validates it against the origin', async () => {
        const { router, openPasskeyCreate } = setup({
            credential: {
                id: 'cred',
                rawId: 'cred',
                type: 'public-key',
                response: {},
            },
        })
        await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: {
                        ...CREATE_OPTIONS,
                        rp: { id: 'webauthn.io', name: 'Example' },
                    },
                },
            },
            'https://webauthn.io',
        )
        expect(openPasskeyCreate.mock.calls[0][0].rpId).toBe('webauthn.io')
    })

    it('declines (never throws) when the requested rp.id is not a registrable suffix of the origin', async () => {
        const { router, openPasskeyCreate } = setup()
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: {
                        ...CREATE_OPTIONS,
                        rp: { id: 'evil.com', name: 'Example' },
                    },
                },
            },
            'https://webauthn.io',
        )
        expect(res).toEqual({ decline: true })
        expect(openPasskeyCreate).not.toHaveBeenCalled()
    })

    it('returns the serialized credential when openPasskeyCreate resolves one', async () => {
        const credential = {
            id: 'cred-id',
            rawId: 'cred-id',
            type: 'public-key' as const,
            response: { clientDataJSON: 'a', attestationObject: 'b' },
        }
        const { router } = setup({ credential })
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: CREATE_OPTIONS,
                },
            },
            'https://webauthn.io',
        )
        expect(res).toEqual({ credential })
    })

    it('declines when the approval window resolves null (user closed it)', async () => {
        const { router } = setup(null)
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: CREATE_OPTIONS,
                },
            },
            'https://webauthn.io',
        )
        expect(res).toEqual({ decline: true })
    })

    it('passes through a real authenticator-level error rather than collapsing it to decline', async () => {
        // usePasskeyApproval.approve()'s catch handler forwards a real
        // Error.name (InvalidStateError, SecurityError, NotAllowedError...)
        // — this must NOT collapse to decline, or the content script would
        // fall through to native and let it mint a duplicate credential the
        // RP tried to exclude via excludeCredentials.
        const { router } = setup({ error: 'InvalidStateError' })
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: CREATE_OPTIONS,
                },
            },
            'https://webauthn.io',
        )
        expect(res).toEqual({ error: 'InvalidStateError' })
    })

    it('collapses a true user decline (reason "declined") to { decline: true }, not a distinct error', async () => {
        // usePasskeyApproval.decline() always sends the literal reason
        // 'declined' — that's the ONE error reason that means "fall through
        // to native," matching a real decline.
        const { router } = setup({ error: 'declined' })
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: CREATE_OPTIONS,
                },
            },
            'https://webauthn.io',
        )
        expect(res).toEqual({ decline: true })
    })

    it('routes a get ceremony via openPasskeyGet, resolving rpId from options.rpId', async () => {
        const credential = {
            id: 'cred-id',
            rawId: 'cred-id',
            type: 'public-key' as const,
            response: {
                clientDataJSON: 'a',
                authenticatorData: 'b',
                signature: 'c',
                userHandle: null,
            },
        }
        const { router, openPasskeyGet } = setup(null, { credential })
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'get',
                    origin: 'https://webauthn.io',
                    options: { ...GET_OPTIONS, rpId: 'webauthn.io' },
                },
            },
            'https://webauthn.io',
        )
        expect(openPasskeyGet).toHaveBeenCalledTimes(1)
        expect(openPasskeyGet.mock.calls[0][0].rpId).toBe('webauthn.io')
        expect(res).toEqual({ credential })
    })

    it('declines instead of throwing when the approval opener itself rejects', async () => {
        const openPasskeyCreate = vi.fn(async () => {
            throw new Error('window creation failed')
        })
        const router = new PasskeyRouter({
            openEnable: vi.fn(),
            openSignTransactions: vi.fn(),
            openSignMessage: vi.fn(),
            openPasskeyCreate,
            openPasskeyGet: vi.fn(),
        } as never)
        const res = await call(
            router,
            {
                scope: WEBAUTHN_RELAY_SCOPE,
                request: {
                    kind: 'create',
                    origin: 'https://webauthn.io',
                    options: CREATE_OPTIONS,
                },
            },
            'https://webauthn.io',
        )
        expect(res).toEqual({ decline: true })
    })
})
