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

// Exercises the platform-agnostic core directly via its public `handle()`
// entry point — no chrome.*, no relay-message envelope, no sender. The
// chrome-transport wiring (isDappRelayMessage gate, sender-origin
// extraction/validation) is a separate concern covered by
// extensions/platform-chrome's ChromeDappRouter tests.
import { describe, it, expect, vi } from 'vitest'
import { DappRequestRouter } from '../router'
import { DappPermissionStore } from '../permissions'
import { ARC0027_ERROR_CODES } from '../types'

const A = 'ADDR_A'.padEnd(58, 'A')
const GENESIS = 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='

const makeArea = () => {
    const backing: Record<string, unknown> = {}
    return {
        get: async (k: string) => (k in backing ? { [k]: backing[k] } : {}),
        set: async (items: Record<string, unknown>) => {
            Object.assign(backing, items)
        },
    }
}

const req = (method: string, id = 'r1', params?: Record<string, unknown>) => ({
    id,
    reference: `arc0027:${method}:request`,
    params,
})

const setup = (
    approveWith: { approvedAddresses: string[] } | null,
    signWith: { stxns: (string | null)[] } | null = null,
    messageWith: { signature: string } | null = null,
) => {
    const permissions = new DappPermissionStore(makeArea(), () => 1)
    const openEnable = vi.fn(async () => approveWith)
    const openSignTransactions = vi.fn(async () => signWith)
    const openSignMessage = vi.fn(async () => messageWith)
    const router = new DappRequestRouter({
        permissions,
        discoverInfo: async () => ({
            providerId: 'pera-wallet',
            name: 'Pera Wallet',
            iconUrl: 'data:image/png;base64,AA==',
            networks: [{ genesisHash: GENESIS, genesisId: 'mainnet-v1.0' }],
        }),
        approvals: {
            openEnable,
            openSignTransactions,
            openSignMessage,
        },
    })
    return {
        router,
        permissions,
        openEnable,
        openSignTransactions,
        openSignMessage,
    }
}

describe('DappRequestRouter (core)', () => {
    it('answers discover locally without consent', async () => {
        const { router, openEnable } = setup(null)
        const res = await router.handle(req('discover'), 'https://x.com')
        expect(res.reference).toBe('arc0027:discover:response')
        expect(res.result!.providerId).toBe('pera-wallet')
        expect(
            (res.result!.networks as { genesisHash: string }[])[0].genesisHash,
        ).toBe(GENESIS)
        expect(openEnable).not.toHaveBeenCalled()
    })

    it('opens the approval window for a fresh enable and grants on approval', async () => {
        const { router, permissions, openEnable } = setup({
            approvedAddresses: [A],
        })
        const res = await router.handle(req('enable'), 'https://x.com')
        expect(openEnable).toHaveBeenCalledTimes(1)
        expect(res.result!.accounts).toEqual([{ address: A }])
        expect(res.result!.genesisHash).toBe(GENESIS)
        expect(await permissions.approvedAddresses('https://x.com')).toEqual([
            A,
        ])
    })

    it('returns MethodCanceledError when the user closes the approval window', async () => {
        const { router, permissions } = setup(null) // opener resolves null
        const res = await router.handle(req('enable'), 'https://x.com')
        expect(res.error!.code).toBe(ARC0027_ERROR_CODES.MethodCanceledError)
        expect(await permissions.isConnected('https://x.com')).toBe(false)
    })

    it('answers an already-approved enable silently (no window)', async () => {
        const { router, permissions, openEnable } = setup(null)
        await permissions.grant('https://x.com', [A])
        const res = await router.handle(req('enable'), 'https://x.com')
        expect(openEnable).not.toHaveBeenCalled()
        expect(res.result!.accounts).toEqual([{ address: A }])
    })

    it('is idempotent: a duplicate in-flight enable id reuses the same window promise', async () => {
        let resolveOpen: (
            v: { approvedAddresses: string[] } | null,
        ) => void = () => {}
        const openEnable = vi.fn(
            () =>
                new Promise<{ approvedAddresses: string[] } | null>(
                    r => (resolveOpen = r),
                ),
        )
        const permissions = new DappPermissionStore(makeArea(), () => 1)
        const router = new DappRequestRouter({
            permissions,
            discoverInfo: async () => ({
                providerId: 'p',
                name: 'P',
                iconUrl: '',
                networks: [{ genesisHash: GENESIS, genesisId: 'mainnet-v1.0' }],
            }),
            approvals: {
                openEnable,
                openSignTransactions: vi.fn(async () => null),
                openSignMessage: vi.fn(async () => null),
            },
        })
        const first = router.handle(req('enable', 'dup'), 'https://x.com')
        const second = router.handle(req('enable', 'dup'), 'https://x.com')
        // Let the permission-check microtasks (readMap → get → approvedAddresses)
        // drain before resolving the opener, so `resolveOpen` targets the real
        // resolver assigned by the (deduped, single) `openEnable` call rather
        // than the initial no-op stub.
        await new Promise(resolve => setTimeout(resolve, 0))
        resolveOpen({ approvedAddresses: [A] })
        const [r1, r2] = await Promise.all([first, second])
        expect(openEnable).toHaveBeenCalledTimes(1)
        expect(r1.result!.accounts).toEqual([{ address: A }])
        expect(r2.result!.accounts).toEqual([{ address: A }])
    })

    it('disable revokes the origin', async () => {
        const { router, permissions } = setup(null)
        await permissions.grant('https://x.com', [A])
        const res = await router.handle(req('disable'), 'https://x.com')
        expect(res.result).toBeDefined()
        expect(await permissions.isConnected('https://x.com')).toBe(false)
    })

    it('returns MethodNotSupported for post_transactions (deferred)', async () => {
        const { router } = setup(null)
        const res = await router.handle(
            req('post_transactions'),
            'https://x.com',
        )
        expect(res.error!.code).toBe(
            ARC0027_ERROR_CODES.MethodNotSupportedError,
        )
    })

    it('returns MethodNotSupported for sign_and_post_transactions (deferred)', async () => {
        const { router } = setup(null)
        const res = await router.handle(
            req('sign_and_post_transactions'),
            'https://x.com',
        )
        expect(res.error!.code).toBe(
            ARC0027_ERROR_CODES.MethodNotSupportedError,
        )
    })

    describe('sign_transactions', () => {
        const TXN = 'gqNzaWfEQA=='

        it('opens the sign window for a connected origin and returns stxns', async () => {
            const { router, permissions, openSignTransactions } = setup(null, {
                stxns: [TXN],
            })
            await permissions.grant('https://x.com', [A])
            const res = await router.handle(
                req('sign_transactions', 'r1', { txns: [{ txn: TXN }] }),
                'https://x.com',
            )
            expect(openSignTransactions).toHaveBeenCalledTimes(1)
            expect(res.result!.providerId).toBe('pera-wallet')
            expect(res.result!.stxns).toEqual([TXN])
        })

        it('rejects a NOT-connected origin as UnauthorizedSignerError without opening a window', async () => {
            const { router, openSignTransactions } = setup(null, {
                stxns: [TXN],
            })
            const res = await router.handle(
                req('sign_transactions', 'r1', { txns: [{ txn: TXN }] }),
                'https://x.com',
            )
            expect(res.error!.code).toBe(
                ARC0027_ERROR_CODES.UnauthorizedSignerError,
            )
            expect(openSignTransactions).not.toHaveBeenCalled()
        })

        it('rejects missing/empty params.txns as InvalidInputError', async () => {
            const { router, permissions, openSignTransactions } = setup(null, {
                stxns: [TXN],
            })
            await permissions.grant('https://x.com', [A])
            const res = await router.handle(
                req('sign_transactions', 'r1', {}),
                'https://x.com',
            )
            expect(res.error!.code).toBe(ARC0027_ERROR_CODES.InvalidInputError)
            expect(openSignTransactions).not.toHaveBeenCalled()
        })

        it('returns MethodCanceledError when the opener resolves null', async () => {
            const { router, permissions } = setup(null, null)
            await permissions.grant('https://x.com', [A])
            const res = await router.handle(
                req('sign_transactions', 'r1', { txns: [{ txn: TXN }] }),
                'https://x.com',
            )
            expect(res.error!.code).toBe(
                ARC0027_ERROR_CODES.MethodCanceledError,
            )
        })

        it('is idempotent: a duplicate in-flight id reuses the same window promise', async () => {
            let resolveOpen: (
                v: { stxns: (string | null)[] } | null,
            ) => void = () => {}
            const openSignTransactions = vi.fn(
                () =>
                    new Promise<{ stxns: (string | null)[] } | null>(
                        r => (resolveOpen = r),
                    ),
            )
            const permissions = new DappPermissionStore(makeArea(), () => 1)
            await permissions.grant('https://x.com', [A])
            const router = new DappRequestRouter({
                permissions,
                discoverInfo: async () => ({
                    providerId: 'p',
                    name: 'P',
                    iconUrl: '',
                    networks: [
                        { genesisHash: GENESIS, genesisId: 'mainnet-v1.0' },
                    ],
                }),
                approvals: {
                    openEnable: vi.fn(async () => null),
                    openSignTransactions,
                    openSignMessage: vi.fn(async () => null),
                },
            })
            const params = { txns: [{ txn: TXN }] }
            const first = router.handle(
                req('sign_transactions', 'dup', params),
                'https://x.com',
            )
            const second = router.handle(
                req('sign_transactions', 'dup', params),
                'https://x.com',
            )
            await new Promise(resolve => setTimeout(resolve, 0))
            resolveOpen({ stxns: [TXN] })
            const [r1, r2] = await Promise.all([first, second])
            expect(openSignTransactions).toHaveBeenCalledTimes(1)
            expect(r1.result!.stxns).toEqual([TXN])
            expect(r2.result!.stxns).toEqual([TXN])
        })
    })

    describe('sign_message', () => {
        it('opens the sign window for a connected origin and returns a signature', async () => {
            const { router, permissions, openSignMessage } = setup(null, null, {
                signature: 'sig-1',
            })
            await permissions.grant('https://x.com', [A])
            const res = await router.handle(
                req('sign_message', 'r1', { message: 'hello' }),
                'https://x.com',
            )
            expect(openSignMessage).toHaveBeenCalledTimes(1)
            expect(res.result!.providerId).toBe('pera-wallet')
            expect(res.result!.signature).toBe('sig-1')
        })

        it('rejects a NOT-connected origin as UnauthorizedSignerError without opening a window', async () => {
            const { router, openSignMessage } = setup(null, null, {
                signature: 'sig-1',
            })
            const res = await router.handle(
                req('sign_message', 'r1', { message: 'hello' }),
                'https://x.com',
            )
            expect(res.error!.code).toBe(
                ARC0027_ERROR_CODES.UnauthorizedSignerError,
            )
            expect(openSignMessage).not.toHaveBeenCalled()
        })
    })

    it('answers a shapeless request body with InvalidInputError instead of throwing', async () => {
        const { router } = setup(null)
        expect(() => router.handle({}, 'https://x.com')).not.toThrow()
        const res = await router.handle({}, 'https://x.com')
        expect(res.error!.code).toBe(ARC0027_ERROR_CODES.InvalidInputError)
        expect(res.requestId).toBe('unknown')
    })

    it('echoes requestId for a malformed request missing only the reference', async () => {
        const { router } = setup(null)
        const malformed = { id: 'abc' }
        expect(() => router.handle(malformed, 'https://x.com')).not.toThrow()
        const res = await router.handle(malformed, 'https://x.com')
        expect(res.error!.code).toBe(ARC0027_ERROR_CODES.InvalidInputError)
        expect(res.requestId).toBe('abc')
    })
})
