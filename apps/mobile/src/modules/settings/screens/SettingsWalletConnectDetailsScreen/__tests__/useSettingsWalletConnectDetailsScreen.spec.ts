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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NoConnectionError } from '@perawallet/wallet-core-shared'

const mocks = vi.hoisted(() => ({
    disconnect: vi.fn(),
    goBack: vi.fn(),
    showError: vi.fn(),
    pushWebView: vi.fn(),
}))

// This branch's screen takes `disconnect` from the connector-free control
// hook, not from useWalletConnect(network) — no UI surface may own a WC
// connector on the extension (webConnectorOwnership.test.ts).
vi.mock('@modules/walletconnect/hooks/useWalletConnectSessionsControl', () => ({
    useWalletConnectSessionsControl: () => ({
        disconnect: mocks.disconnect,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: mocks.goBack }),
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mocks.pushWebView }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useSettingsWalletConnectDetailsScreen } from '../useSettingsWalletConnectDetailsScreen'

const session = {
    clientId: 'client-1',
    session: { accounts: [], peerMeta: { name: 'Dapp', url: 'https://d.app' } },
} as never

describe('useSettingsWalletConnectDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.disconnect.mockResolvedValue(undefined)
    })

    it('navigates back once the session is actually revoked', async () => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(session),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(mocks.disconnect).toHaveBeenCalledWith('client-1')
        expect(mocks.goBack).toHaveBeenCalledTimes(1)
        expect(mocks.showError).not.toHaveBeenCalled()
    })

    // Before PERA-4585 goBack() ran from .finally, so a failed revoke closed
    // the screen and the session stayed listed — indistinguishable from success.
    it('keeps the user on the screen and reports the failure when revoke rejects', async () => {
        const error = new NoConnectionError()
        mocks.disconnect.mockRejectedValue(error)

        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(session),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(mocks.showError).toHaveBeenCalledWith(
            error,
            // This branch names the failure specifically rather than
            // reusing the generic error title.
            'walletconnect.settings.disconnect_failed_title',
        )
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it('clears the loading flag whichever way the revoke ends', async () => {
        mocks.disconnect.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(session),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(result.current.isLoading).toBe(false)
    })
    it('closes the modal without disconnecting when the session has no clientId', () => {
        // Nothing to revoke, so the socket is never touched — but the sheet
        // must still close or the user is stuck behind it.
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...(session as object),
                clientId: undefined,
            } as never),
        )

        act(() => {
            result.current.handleDelete()
        })

        expect(mocks.disconnect).not.toHaveBeenCalled()
        expect(result.current.deleteModalState.isOpen).toBe(false)
    })
})
