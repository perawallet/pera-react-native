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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { InboxItem } from '@perawallet/wallet-core-messages'
import { useHandleInboxItemPress } from '../useHandleInboxItemPress'

/**
 * Guards the invariant that this hook works with **no navigation context**.
 *
 * `useNotificationDeeplinkListener` reaches it from RootComponent, which mounts
 * the listener at RootComponent.tsx:80 but only renders `<MainRoutes/>` — the
 * component that owns NavigationContainer — at :102. So in production this hook
 * runs above the container, and any `useNavigation`/`useAppNavigation` in its
 * tree throws during render on every launch.
 *
 * The mock below is the load-bearing part. `vitest.setup.ts:1587` globally mocks
 * `@react-navigation/native` so that `useNavigation()` returns a working stub
 * and never throws, no matter where a component sits — which means no ordinary
 * unit test in this repo can observe an out-of-container navigation call. That
 * is how shipped this crash with a green suite, including 69 new lines
 * of its own tests. Overriding `useNavigation` to fail the way the real library
 * does is what makes this spec able to catch a reintroduction.
 *
 * Verified load-bearing: with `useAppNavigation` restored in the hook, both
 * cases below fail with "Couldn't find a navigation object".
 */
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => {
        throw new Error(
            "Couldn't find a navigation object. Is your component inside NavigationContainer?",
        )
    },
    // isReady() false models "no container mounted", so pushScreen no-ops
    // instead of dispatching into nothing.
    createNavigationContainerRef: () => ({
        isReady: () => false,
        navigate: vi.fn(),
        dispatch: vi.fn(),
    }),
    StackActions: {
        push: (name: string, params?: unknown) => ({
            type: 'PUSH',
            payload: { name, params },
        }),
    },
}))

const mockErrorToast = vi.fn()

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@modules/messages/components/MultisigInvitationDetailContent', () => ({
    MultisigInvitationDetailContent: () => null,
}))

vi.mock('@modules/multisig/hooks/useHandleMultisigSignTap', () => ({
    useHandleMultisigSignTap: () => vi.fn(),
}))

const asInboxItem = (item: unknown): InboxItem => item as InboxItem

describe('useHandleInboxItemPress outside a navigator', () => {
    it('renders without a NavigationContainer', () => {
        expect(() => renderHook(() => useHandleInboxItemPress())).not.toThrow()
    })

    it('handles an inbox item without a NavigationContainer', () => {
        const asaItem = {
            type: 'asa_inbox' as const,
            data: { address: 'ADDR1', inboxAddress: 'INBOX1', requestCount: 3 },
            createdAt: new Date(0),
        }

        const { result } = renderHook(() => useHandleInboxItemPress())

        // navigationRef.isReady() is false with no container mounted, so the
        // push is a no-op rather than a crash — the point is that resolving
        // navigation never requires React context on this path.
        expect(() =>
            act(() => {
                result.current(asInboxItem(asaItem))
            }),
        ).not.toThrow()
    })
})
