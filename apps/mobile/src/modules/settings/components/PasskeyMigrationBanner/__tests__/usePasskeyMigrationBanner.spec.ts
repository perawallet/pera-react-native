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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Passkey } from '@perawallet/wallet-core-passkeys'

const mocks = vi.hoisted(() => ({
    usePasskeysQuery: vi.fn(),
    readFlaggedPasskeyCredentials: vi.fn(),
}))

// `passkeysQueryKeyRoot`'s real value is pinned package-side by
// `useRemovePasskeyMutation.spec.ts`; here it only has to be the same array the
// hook builds its key from and the invalidation below targets.
vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeysQuery: mocks.usePasskeysQuery,
    readFlaggedPasskeyCredentials: mocks.readFlaggedPasskeyCredentials,
    passkeysQueryKeyRoot: ['passkeys'],
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

import { usePasskeyMigrationBanner } from '../usePasskeyMigrationBanner'

// `id` defaults off `keyId` rather than to a constant, because the two are
// distinct fields with distinct rules: `id` is `toUrlSafeBase64(keyId)`, so a
// fixture that hardcodes both to the same literal makes an id-join and a
// keyId-join indistinguishable. The dedupe test below overrides them apart.
const passkey = (overrides: Partial<Passkey>): Passkey => ({
    id: overrides.keyId ?? 'id',
    keyId: 'id',
    displayName: 'alice',
    origin: 'webauthn.io',
    userHandle: 'alice',
    algorithm: 'P256',
    createdAt: 100,
    source: 'provider',
    needsMigration: true,
    ...overrides,
})

// The read's own shape: `flagged` alone cannot say whether the scan saw
// everything, and `readFlaggedPasskeyCredentials` degrades every documented
// failure to a resolved empty list rather than rejecting.
const scan = (flagged: Passkey[], isComplete = true) => ({
    flagged,
    isComplete,
})

let onRequestDelete: ReturnType<typeof vi.fn>
let queryClient: QueryClient

const createWrapper = () => {
    queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const render = ({
    isManaging = true,
    isProviderActive = true,
}: { isManaging?: boolean; isProviderActive?: boolean } = {}) =>
    renderHook(
        () =>
            usePasskeyMigrationBanner({
                isManaging,
                isProviderActive,
                onRequestDelete: onRequestDelete as (p: Passkey) => void,
            }),
        { wrapper: createWrapper() },
    )

describe('usePasskeyMigrationBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        onRequestDelete = vi.fn()
        mocks.usePasskeysQuery.mockReturnValue({ passkeys: [] })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(scan([]))
    })

    it('stays hidden when nothing is flagged', async () => {
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [passkey({ keyId: 'ok', needsMigration: false })],
        })

        const { result } = render()

        await waitFor(() =>
            expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalled(),
        )
        expect(result.current.affected).toEqual([])
        expect(result.current.isVisible).toBe(false)
    })

    it('surfaces a credential the flat provider store flags, which the passkey list never sees', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })]),
        )

        const { result } = render()

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.affected.map(p => p.keyId)).toEqual(['flat-1'])
    })

    it('also surfaces a flagged row that kept its k/ record and so is still in the list', async () => {
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [
                passkey({ keyId: 'declined', source: 'keystore' }),
                passkey({ keyId: 'fine', needsMigration: false }),
            ],
        })

        const { result } = render()

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.affected.map(p => p.keyId)).toEqual(['declined'])
    })

    // The second flagged credential is what makes this test non-vacuous:
    // waiting on `isVisible` alone would settle on the keystore row before the
    // flat read resolves, and never observe the union at all.
    //
    // The surviving row must be the keystore one. `useRemovePasskeyMutation`
    // gates keystore removal on `source === 'keystore'`, so letting the flat
    // copy win for a credential that still has a k/ record would skip
    // `provider.key.store.remove` and strand the k/+m/ pair.
    //
    // Deduped on `id`, not `keyId`: `id` is `toUrlSafeBase64(keyId)` and both
    // native stores carry a `credentialIdCandidates` normaliser precisely
    // because the same credential's raw id has been persisted in both standard
    // and url-safe base64. `BOTH_*` below is one credential recorded each way,
    // so a keyId-join would list it twice and offer two Remove buttons for one
    // passkey. `mergePasskeys` dedupes on `id` for the same reason.
    it('lists a credential once when both sources report it under differently-encoded ids, keeping the keystore attribution', async () => {
        const BOTH_ID = 'q-_ABC'
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [
                passkey({
                    id: BOTH_ID,
                    keyId: 'q+/ABC==',
                    source: 'keystore',
                }),
            ],
        })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([
                passkey({ id: BOTH_ID, keyId: 'q-_ABC=', source: 'provider' }),
                passkey({ keyId: 'flat-only', source: 'provider' }),
            ]),
        )

        const { result } = render()

        await waitFor(() => expect(result.current.affected).toHaveLength(2))
        expect(result.current.affected.map(p => p.id)).toEqual([
            BOTH_ID,
            'flat-only',
        ])
        expect(result.current.affected.map(p => p.source)).toEqual([
            'keystore',
            'provider',
        ])
    })

    // The banner's query key is a sibling of `passkeysQueryKey`, not a
    // descendant, so only an invalidation of the shared `['passkeys']` root
    // reaches it — which is what `useRemovePasskeyMutation` now issues. Without
    // it the banner keeps offering "Remove" for a credential already gone.
    it('re-reads the flat store when the shared passkeys root is invalidated', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })]),
        )

        const { result } = render()
        await waitFor(() => expect(result.current.isVisible).toBe(true))

        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(scan([]))
        await act(async () => {
            await queryClient.invalidateQueries({ queryKey: ['passkeys'] })
        })

        await waitFor(() => expect(result.current.affected).toEqual([]))
        expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalledTimes(2)
        expect(result.current.isVisible).toBe(false)
    })

    // Same predicate the screen's prerequisite callouts use, so nothing stacks
    // on top of a loading, errored or provider-disabled screen. It is not the
    // lockout gate: `resolveState` returns `populated` before it consults the
    // provider, so a provider-off screen with at least one passkey is still
    // "managing". `canRecreate` withholds the banner's own action there, and
    // the screen's `canRemove` withholds the matching one on the list row —
    // reading `affected` below, which is the only place a row whose own
    // `needsMigration` is unreadable (`source: 'native'`) is known to be
    // flagged at all.
    it('stays hidden while the screen is not managing passkeys', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })]),
        )

        const { result } = render({ isManaging: false })

        await waitFor(() => expect(result.current.affected).toHaveLength(1))
        expect(result.current.isVisible).toBe(false)
    })

    // The warning itself is true regardless of the provider state and the user
    // should still see it. What must not be offered is delete-and-recreate:
    // removing the credential is irreversible, and the replacement can only be
    // registered once Pera is the active provider again.
    it('keeps warning but withholds the recreate action while the provider is off', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })]),
        )

        const { result } = render({ isProviderActive: false })

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.affected).toHaveLength(1)
        expect(result.current.canRecreate).toBe(false)
    })

    it('offers the recreate action once the provider is active', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })]),
        )

        const { result } = render()

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.canRecreate).toBe(true)
    })

    it('hides on dismiss without deleting anything', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })]),
        )

        const { result } = render()
        await waitFor(() => expect(result.current.isVisible).toBe(true))

        act(() => result.current.onDismiss())

        expect(result.current.isVisible).toBe(false)
        expect(result.current.affected).toHaveLength(1)
        expect(onRequestDelete).not.toHaveBeenCalled()
    })

    // Deleting a passkey the relying party still trusts locks the user out of
    // that account, so the banner only ever hands the credential to the
    // screen's existing confirmation flow.
    it('routes recreate through the confirming delete flow rather than deleting directly', async () => {
        const flagged = passkey({ keyId: 'flat-1' })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(scan([flagged]))

        const { result } = render()
        await waitFor(() => expect(result.current.isVisible).toBe(true))

        act(() => result.current.onRecreate(result.current.affected[0]))

        expect(onRequestDelete).toHaveBeenCalledWith(
            expect.objectContaining({ keyId: 'flat-1' }),
        )
    })

    it('stays hidden when the flat read fails', async () => {
        mocks.readFlaggedPasskeyCredentials.mockRejectedValue(
            new Error('keychain unavailable'),
        )

        const { result } = render()

        await waitFor(() =>
            expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalled(),
        )
        expect(result.current.isVisible).toBe(false)
    })

    // An empty `affected` means "flagged: none" only once the read has
    // answered. The screen's row gate is the consumer that must tell the two
    // apart — a `source: 'native'` row has no readable marker of its own, so
    // "not known yet" read as "not flagged" is a one-way delete offered on the
    // one credential that can't come back.
    it('reports the flag source incomplete while the read is still in flight', async () => {
        mocks.readFlaggedPasskeyCredentials.mockReturnValue(
            new Promise(() => {}),
        )

        const { result } = render()

        await waitFor(() =>
            expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalled(),
        )
        expect(result.current.affected).toEqual([])
        expect(result.current.isFlagSourceComplete).toBe(false)
    })

    // Waits for the query to actually reach `error`. Waiting only on the mock
    // having been called observes the *pending* state, where every candidate
    // gate reads false — which is how a previous round's version of this test
    // stayed green against a gate that could not detect failure at all.
    it('reports the flag source incomplete once the read has failed', async () => {
        mocks.readFlaggedPasskeyCredentials.mockRejectedValue(
            new Error('keychain unavailable'),
        )

        const { result } = render()

        await waitFor(() =>
            expect(
                queryClient.getQueryState(['passkeys', 'needs-migration'])
                    ?.status,
            ).toBe('error'),
        )
        expect(result.current.isFlagSourceComplete).toBe(false)
    })

    // The failure this whole gate exists for, and the one a rejection can never
    // represent: `readFlaggedPasskeyCredentials` catches `getAllKeys` throwing,
    // an unreadable master key and an unopenable record alike, and *resolves*
    // with an empty list. The query is a clean success; only `isComplete` says
    // the empty list means nothing.
    it('reports the flag source incomplete when a resolved read could not examine everything', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(scan([], false))

        const { result } = render()

        await waitFor(() =>
            expect(
                queryClient.getQueryState(['passkeys', 'needs-migration'])
                    ?.status,
            ).toBe('success'),
        )
        expect(result.current.affected).toEqual([])
        expect(result.current.isFlagSourceComplete).toBe(false)
    })

    // The partial case: an incomplete scan still reports what it did find, so
    // the warning does not disappear just because one neighbouring record was
    // unreadable.
    it('still surfaces what an incomplete read did find', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(
            scan([passkey({ keyId: 'flat-1' })], false),
        )

        const { result } = render()

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.affected.map(p => p.keyId)).toEqual(['flat-1'])
        expect(result.current.isFlagSourceComplete).toBe(false)
    })

    it('reports the flag source complete once a whole-store read resolves', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue(scan([]))

        const { result } = render()

        await waitFor(() =>
            expect(result.current.isFlagSourceComplete).toBe(true),
        )
    })
})
