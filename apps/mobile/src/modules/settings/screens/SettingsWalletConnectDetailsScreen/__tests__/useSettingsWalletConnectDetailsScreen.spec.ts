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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { ConnectionSettingsRow } from '@perawallet/wallet-core-connections'

type MockAccount = {
    id: string
    chains: Record<string, { address: string }>
}

const mocks = vi.hoisted(() => ({
    revoke: vi.fn(),
    goBack: vi.fn(),
    showError: vi.fn(),
    pushWebView: vi.fn(),
    accounts: [] as MockAccount[],
}))

const network = (
    id: string,
    tier: string,
    displayName: string,
    isDefaultForTier: boolean,
) => ({ id, tier, displayName, isDefaultForTier })

const DESCRIPTORS: Record<
    string,
    { displayName: string; networks: unknown[] }
> = {
    algorand: {
        displayName: 'Algorand',
        networks: [
            network('mainnet', 'mainnet', 'MainNet', true),
            network('testnet', 'testnet', 'TestNet', true),
            network('betanet', 'testnet', 'BetaNet', false),
        ],
    },
    ethereum: {
        displayName: 'Ethereum',
        networks: [
            network('mainnet', 'mainnet', 'Mainnet', true),
            network('sepolia', 'testnet', 'Sepolia', true),
        ],
    },
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            has: (chainId: string) => chainId in DESCRIPTORS,
            get: (chainId: string) => ({ descriptor: DESCRIPTORS[chainId] }),
        },
    }),
}))

// The screen revokes through the settings list hook's awaited `revoke`, not
// a connector of its own — no UI surface may own a WC connector
// (the oxlint rule pera/wc-connector-ownership).
vi.mock('@modules/settings/hooks/useConnectionSettingsList', () => ({
    useConnectionSettingsList: () => ({ revoke: mocks.revoke }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mocks.accounts,
    useRegisteredChainIds: () => ['algorand', 'ethereum'],
    findAccountByAddressOn: (
        accounts: MockAccount[],
        chainId: string,
        address: string,
    ) => accounts.find(account => account.chains[chainId]?.address === address),
}))

vi.mock('@react-navigation/native', async importOriginal => ({
    ...(await importOriginal<typeof import('@react-navigation/native')>()),
    useNavigation: () => ({ goBack: mocks.goBack }),
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mocks.pushWebView }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    WalletConnectEvent: { SessionDisconnected: 'session-disconnected' },
    AnalyticsMetadataKey: {
        DappName: 'dappName',
        DappUrl: 'dappUrl',
        WcVersion: 'wcVersion',
        ChainId: 'chain_id',
    },
}))

import { trackEvent } from '@analytics'
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
    networks: [{ chainId: 'algorand', networkId: 'mainnet' }],
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

    it('tracks the disconnect with the protocol version as the analytics enum', async () => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...connectionRow(),
                kind: 'walletconnect-v2',
                protocolVersion: 2,
            }),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(trackEvent).toHaveBeenCalledWith(
            'session-disconnected',
            expect.objectContaining({ wcVersion: '2', chain_id: 'algorand' }),
        )
    })

    it('still tracks the disconnect once when the session lists no network', async () => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...connectionRow(),
                networks: [],
            }),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(vi.mocked(trackEvent).mock.calls).toEqual([
            [
                'session-disconnected',
                expect.objectContaining({ chain_id: 'algorand' }),
            ],
        ])
    })

    it('tracks the disconnect once per distinct chain the session spans', async () => {
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...connectionRow(),
                networks: [
                    { chainId: 'algorand', networkId: 'mainnet' },
                    { chainId: 'ethereum', networkId: 'mainnet' },
                    { chainId: 'ethereum', networkId: 'sepolia' },
                ],
            }),
        )

        await act(async () => {
            result.current.handleDelete()
        })

        expect(vi.mocked(trackEvent).mock.calls).toEqual([
            [
                'session-disconnected',
                expect.objectContaining({ chain_id: 'algorand' }),
            ],
            [
                'session-disconnected',
                expect.objectContaining({ chain_id: 'ethereum' }),
            ],
        ])
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

describe('useSettingsWalletConnectDetailsScreen — connected accounts', () => {
    const ALGO = 'A'.repeat(58)
    const ETH = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
    const algorandOnly: MockAccount = {
        id: 'algo-only',
        chains: { algorand: { address: ALGO } },
    }
    const both: MockAccount = {
        id: 'both',
        chains: {
            algorand: { address: 'B'.repeat(58) },
            ethereum: { address: ETH },
        },
    }

    const rowsFor = (
        connection: Partial<ConnectionSettingsRow>,
        accounts: MockAccount[],
    ) => {
        mocks.accounts = accounts
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...connectionRow(),
                ...connection,
            }),
        )
        return result.current.connectedAccounts.map(row => ({
            id: (row.account as unknown as MockAccount).id,
            labels: row.networks.map(({ label, tone }) => [label, tone]),
        }))
    }

    beforeEach(() => {
        mocks.accounts = []
    })

    it('labels each account with the networks of its own chain only', () => {
        const rows = rowsFor(
            {
                accounts: [ALGO, ETH],
                networks: [
                    { chainId: 'algorand', networkId: 'mainnet' },
                    { chainId: 'ethereum', networkId: 'mainnet' },
                    { chainId: 'ethereum', networkId: 'sepolia' },
                ],
            },
            [algorandOnly, both],
        )

        expect(rows).toEqual([
            { id: 'algo-only', labels: [['MainNet', 'mainnet']] },
            {
                id: 'both',
                labels: [
                    ['Mainnet', 'mainnet'],
                    ['Sepolia', 'testnet'],
                ],
            },
        ])
    })

    it('groups an account holding addresses on two chains into one row', () => {
        const rows = rowsFor(
            {
                accounts: ['B'.repeat(58), ETH],
                networks: [
                    { chainId: 'algorand', networkId: 'mainnet' },
                    { chainId: 'ethereum', networkId: 'sepolia' },
                ],
            },
            [both],
        )

        expect(rows).toEqual([
            {
                id: 'both',
                labels: [
                    ['MainNet', 'mainnet'],
                    ['Sepolia', 'testnet'],
                ],
            },
        ])
    })

    it('drops a network its chain does not list, such as the custom node slot', () => {
        const rows = rowsFor(
            {
                accounts: [ALGO],
                networks: [
                    { chainId: 'algorand', networkId: 'custom' },
                    { chainId: 'algorand', networkId: 'betanet' },
                    {
                        chainId: 'unregistered' as ChainId,
                        networkId: 'mainnet',
                    },
                ],
            },
            [algorandOnly],
        )

        expect(rows).toEqual([
            { id: 'algo-only', labels: [['BetaNet', 'other']] },
        ])
    })

    it('shows an account on the chain it was found on, and names each network with its chain', () => {
        mocks.accounts = [both]
        const { result } = renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...connectionRow(),
                accounts: [ETH],
                networks: [
                    { chainId: 'ethereum', networkId: 'mainnet' },
                    { chainId: 'ethereum', networkId: 'sepolia' },
                ],
            }),
        )

        const [row] = result.current.connectedAccounts
        expect(row.chainId).toBe('ethereum')
        expect(
            row.networks.map(({ chainId, chainName, label }) => [
                chainId,
                chainName,
                label,
            ]),
        ).toEqual([
            ['ethereum', 'Ethereum', 'Mainnet'],
            ['ethereum', 'Ethereum', 'Sepolia'],
        ])
    })

    it('lists no row for an address the wallet no longer holds', () => {
        expect(
            rowsFor(
                {
                    accounts: ['GONE'],
                    networks: [{ chainId: 'algorand', networkId: 'mainnet' }],
                },
                [algorandOnly],
            ),
        ).toEqual([])
    })
})

describe('useSettingsWalletConnectDetailsScreen — permissions', () => {
    const permissionsFor = (permissions: string[]) =>
        renderHook(() =>
            useSettingsWalletConnectDetailsScreen({
                ...connectionRow(),
                permissions,
            }),
        ).result.current.permissions

    it('maps an EVM session’s methods to plain permissions', () => {
        expect(
            permissionsFor([
                'eth_sendTransaction',
                'personal_sign',
                'wallet_switchEthereumChain',
            ]),
        ).toEqual([
            'view-accounts',
            'approve-transactions',
            'sign-messages',
            'switch-networks',
        ])
    })

    it('still lists viewing accounts for a record that stored no permissions', () => {
        expect(permissionsFor([])).toEqual(['view-accounts'])
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
