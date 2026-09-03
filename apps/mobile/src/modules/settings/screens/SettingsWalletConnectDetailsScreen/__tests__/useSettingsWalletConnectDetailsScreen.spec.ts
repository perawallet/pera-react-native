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
import type { ConnectionSettingsRow } from '@modules/settings/hooks/connectionSettingsReadModel'

const mocks = vi.hoisted(() => ({
    revoke: vi.fn(),
    goBack: vi.fn(),
    showError: vi.fn(),
    pushWebView: vi.fn(),
}))

// The screen revokes through the settings list hook's awaited `revoke`, not
// a connector of its own — no UI surface may own a WC connector
// (webConnectorOwnership.test.ts).
vi.mock('@modules/settings/hooks/useConnectionSettingsList', () => ({
    useConnectionSettingsList: () => ({ revoke: mocks.revoke }),
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

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    WalletConnectEvent: { SessionDisconnected: 'session-disconnected' },
    AnalyticsMetadataKey: { DappName: 'dappName', DappUrl: 'dappUrl' },
}))

import { useSettingsWalletConnectDetailsScreen } from '../useSettingsWalletConnectDetailsScreen'

const connectionRow = (url = 'https://d.app'): ConnectionSettingsRow => ({
    id: 'client-1',
    kind: 'walletconnect-v1',
    title: 'Dapp',
    subtitle: url,
    accounts: [],
    isConnected: true,
    createdAt: 0,
    lastActiveAt: 0,
    peer: { name: 'Dapp', url },
    permissions: ['algo_signTxn'],
    networks: ['mainnet'],
    protocolVersion: 1,
})

describe('useSettingsWalletConnectDetailsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.revoke.mockResolvedValue(undefined)
    })

    it('navigates back once the session is actually revoked', async () => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(connectionRow()),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(mocks.revoke).toHaveBeenCalledWith('client-1')
        expect(mocks.goBack).toHaveBeenCalledTimes(1)
        expect(mocks.showError).not.toHaveBeenCalled()
    })

    // goBack() must not run from .finally: a failed revoke would close the
    // screen with the session still listed, indistinguishable from success.
    it('keeps the user on the screen and reports the failure when revoke rejects', async () => {
        const error = new NoConnectionError()
        mocks.revoke.mockRejectedValue(error)

        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(connectionRow()),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(mocks.showError).toHaveBeenCalledWith(
            error,
            'walletconnect.settings.disconnect_failed_title',
        )
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it('clears the loading flag whichever way the revoke ends', async () => {
        mocks.revoke.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(connectionRow()),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(result.current.isLoading).toBe(false)
    })
})

describe('useSettingsWalletConnectDetailsScreen — hostile peer URL gating', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each([
        'javascript:alert(document.cookie)',
        'content://com.evil.provider/secret',
        'http://insecure.example',
    ])('does not open the WebView for %s', url => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(connectionRow(url)),
        )

        act(() => result.current.handleOpenLink())

        expect(mocks.pushWebView).not.toHaveBeenCalled()
    })

    it('opens the WebView for a valid https peer URL', () => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen(
                connectionRow('https://d.app'),
            ),
        )

        act(() => result.current.handleOpenLink())

        expect(mocks.pushWebView).toHaveBeenCalledWith({
            id: expect.any(String),
            url: 'https://d.app',
        })
    })
})
