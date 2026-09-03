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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitSecret } from '@perawallet/wallet-core-kms'

const store = new Map<string, Uint8Array>()

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            // Matches the real commitSecret's internal-copy semantics
            // (packages/kms/src/storage/secrets.ts): it never zeroes the
            // caller's buffer, only its own copy. secrets.ts now zeroes its
            // own `bytes` after this call, so aliasing the same reference
            // here (instead of copying) would corrupt the stored value.
            store.set(id, new Uint8Array(bytes))
        },
    ),
    hasSecret: vi.fn((id: string) => store.has(id)),
    withSecret: vi.fn(
        async (id: string, handler: (b: Uint8Array) => unknown) =>
            store.has(id) ? handler(store.get(id)!) : null,
    ),
    removeSecret: vi.fn(async (id: string) => void store.delete(id)),
    zeroBytes: vi.fn((bytes: Uint8Array) => bytes.fill(0)),
}))

const {
    commitSessionKey,
    removeSessionKey,
    sessionKeySecretRef,
    withSessionKey,
} = await import('../secrets')

describe('v1 session key storage', () => {
    beforeEach(() => {
        store.clear()
        vi.clearAllMocks()
    })

    it('namespaces the secret ref by client id', () => {
        expect(sessionKeySecretRef('abc')).toBe('wc1-session-key:abc')
    })

    it('round-trips a hex session key', async () => {
        await commitSessionKey('abc', 'deadbeef')

        expect(await withSessionKey('abc', key => key)).toBe('deadbeef')
    })

    it('returns null for an unknown client id rather than throwing', async () => {
        expect(await withSessionKey('missing', key => key)).toBeNull()
    })

    it('is idempotent — a second commit does not duplicate', async () => {
        const first = await commitSessionKey('abc', 'deadbeef')
        const second = await commitSessionKey('abc', 'deadbeef')

        expect(first).toBe(second)
        expect(store.size).toBe(1)
        // `store.size` alone can't distinguish "guard skipped the second
        // write" from "guard doesn't exist" — Map.set on an existing key
        // never changes size either way. The call count is the assertion
        // that actually proves the hasSecret guard ran.
        expect(commitSecret).toHaveBeenCalledTimes(1)
    })

    it('removes cleanly', async () => {
        await commitSessionKey('abc', 'deadbeef')
        await removeSessionKey('abc')

        expect(await withSessionKey('abc', key => key)).toBeNull()
    })
})
