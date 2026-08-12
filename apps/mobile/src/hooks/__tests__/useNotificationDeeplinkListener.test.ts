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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotificationDeeplinkListener } from '../useNotificationDeeplinkListener'

type NotificationOpenPayload = {
    url?: string
    type?: string
    accountAddress?: string
}

const mocks = vi.hoisted(() => {
    const state = {
        listener: null as ((payload: NotificationOpenPayload) => void) | null,
    }
    const unsubscribe = vi.fn()
    return {
        state,
        unsubscribe,
        handleDeepLink: vi.fn(),
        isValidDeepLink: vi.fn((_: string) => true),
        handleMultisigNotification: vi.fn(),
        addNotificationOpenListener: vi.fn(
            (listener: (payload: NotificationOpenPayload) => void) => {
                state.listener = listener
                return unsubscribe
            },
        ),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({
        pushNotification: {
            addNotificationOpenListener: mocks.addNotificationOpenListener,
        },
    }),
}))

vi.mock('../useDeepLink', () => ({
    useDeepLink: () => ({
        handleDeepLink: mocks.handleDeepLink,
        isValidDeepLink: mocks.isValidDeepLink,
    }),
}))

vi.mock('@modules/messages/hooks', () => ({
    getMultisigIntentKind: (type: string | undefined) =>
        type === 'multisig-new-sign-request'
            ? 'sign'
            : type === 'multi-sig-import-account'
              ? 'import'
              : null,
    useHandleMultisigNotification: () => ({
        handleMultisigNotification: mocks.handleMultisigNotification,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('useNotificationDeeplinkListener', () => {
    beforeEach(() => {
        mocks.state.listener = null
        mocks.unsubscribe.mockReset()
        mocks.handleDeepLink.mockReset()
        mocks.handleMultisigNotification.mockReset()
        mocks.addNotificationOpenListener.mockClear()
        mocks.isValidDeepLink.mockReset().mockReturnValue(true)
    })

    it('registers a listener on mount and unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useNotificationDeeplinkListener())

        expect(mocks.addNotificationOpenListener).toHaveBeenCalledTimes(1)

        unmount()
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('routes a tapped-notification deeplink through handleDeepLink', () => {
        renderHook(() => useNotificationDeeplinkListener())

        act(() => mocks.state.listener?.({ url: 'perawallet://app/cards' }))

        expect(mocks.handleDeepLink).toHaveBeenCalledWith(
            'perawallet://app/cards',
            false,
            'notification',
        )
    })

    it('ignores a notification URL that is not a valid deeplink', () => {
        mocks.isValidDeepLink.mockReturnValue(false)
        renderHook(() => useNotificationDeeplinkListener())

        act(() =>
            mocks.state.listener?.({ url: 'https://example.com/marketing' }),
        )

        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
    })

    it('routes a multisig sign-request push through the multisig resolver, not handleDeepLink', () => {
        renderHook(() => useNotificationDeeplinkListener())

        act(() =>
            mocks.state.listener?.({
                type: 'multisig-new-sign-request',
                accountAddress: 'MSIG_ADDR',
                // Address-keyed URL the payload actually carries — must be
                // ignored in favor of type-based routing.
                url: 'perawallet://asset-inbox/?address=MSIG_ADDR',
            }),
        )

        expect(mocks.handleMultisigNotification).toHaveBeenCalledWith(
            'sign',
            'MSIG_ADDR',
        )
        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
    })

    it('routes a multisig import push through the multisig resolver', () => {
        renderHook(() => useNotificationDeeplinkListener())

        act(() =>
            mocks.state.listener?.({
                type: 'multi-sig-import-account',
                accountAddress: 'MSIG_IMPORT_ADDR',
            }),
        )

        expect(mocks.handleMultisigNotification).toHaveBeenCalledWith(
            'import',
            'MSIG_IMPORT_ADDR',
        )
        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
    })
})
