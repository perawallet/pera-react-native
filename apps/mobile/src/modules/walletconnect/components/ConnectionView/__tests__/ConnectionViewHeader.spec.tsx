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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectionViewHeader } from '../ConnectionViewHeader'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'

const mockPushWebView = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}:${JSON.stringify(opts)}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-walletconnect', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-walletconnect')
        >()
    return {
        ...actual,
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        generateOrderedUniqueId: () => 'mock-id',
    }
})

vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

vi.mock('@components/core', () => ({
    PWBadge: ({ value }: { value: string }) => (
        <span data-testid='PWBadge'>{value}</span>
    ),
    PWButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
        <button onClick={onPress}>{title}</button>
    ),
    PWIcon: () => <div data-testid='PWIcon' />,
    PWImage: ({ source }: { source: { uri: string } }) => (
        <img
            data-testid='PWImage'
            src={source.uri}
        />
    ),
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock('../../PermissionItem', () => ({
    PermissionItem: ({ permission }: { permission: string }) => (
        <span data-testid='PermissionItem'>{permission}</span>
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        headerContainer: {},
        networksContainer: {},
        icon: {},
        iconContainer: {},
        titleContainer: {},
        title: {},
        permissionsContainer: {},
        permissionsTitle: {},
        accountSelectionContainer: {},
    }),
}))

const createRequest = (overrides: Partial<WalletConnectSessionRequest> = {}) =>
    ({
        peerMeta: {
            name: 'Test dApp',
            url: 'https://test-dapp.com',
            icons: ['https://test-dapp.com/icon.png'],
            description: 'A test dApp',
        },
        chainId: 416001,
        permissions: ['algo_getAccounts', 'algo_signTxn'],
        clientId: 'client-123',
        ...overrides,
    }) as unknown as WalletConnectSessionRequest

describe('ConnectionViewHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('displays the dApp name in the title', () => {
        render(<ConnectionViewHeader request={createRequest()} />)

        expect(
            screen.getByText(/walletconnect\.request\.title.*Test dApp/),
        ).toBeDefined()
    })

    test('renders dApp icon when available', () => {
        render(<ConnectionViewHeader request={createRequest()} />)

        expect(screen.getByTestId('PWImage')).toBeDefined()
    })

    test('renders fallback icon when no icons available', () => {
        const request = createRequest({
            peerMeta: {
                name: 'Test dApp',
                url: 'https://test-dapp.com',
                icons: [],
                description: '',
            },
        } as Partial<WalletConnectSessionRequest>)

        render(<ConnectionViewHeader request={request} />)

        expect(screen.queryByTestId('PWImage')).toBeNull()
        expect(screen.getAllByTestId('PWIcon').length).toBeGreaterThan(0)
    })

    test('renders single mainnet badge for mainnet chain', () => {
        render(
            <ConnectionViewHeader
                request={createRequest({ chainId: 416001 })}
            />,
        )

        const badges = screen.getAllByTestId('PWBadge')
        expect(badges).toHaveLength(1)
        expect(badges[0].textContent).toBe(
            'walletconnect.request.networks_mainnet',
        )
    })

    test('renders single testnet badge for testnet chain', () => {
        render(
            <ConnectionViewHeader
                request={createRequest({ chainId: 416002 })}
            />,
        )

        const badges = screen.getAllByTestId('PWBadge')
        expect(badges).toHaveLength(1)
        expect(badges[0].textContent).toBe(
            'walletconnect.request.networks_testnet',
        )
    })

    test('renders both mainnet and testnet badges for "all" chain', () => {
        render(
            <ConnectionViewHeader
                request={createRequest({
                    chainId: 4160,
                } as Partial<WalletConnectSessionRequest>)}
            />,
        )

        const badges = screen.getAllByTestId('PWBadge')
        expect(badges).toHaveLength(2)
    })

    test('renders a PermissionItem for each permission', () => {
        render(<ConnectionViewHeader request={createRequest()} />)

        const items = screen.getAllByTestId('PermissionItem')
        expect(items).toHaveLength(2)
    })

    test('opens web view when dApp URL is pressed', () => {
        render(<ConnectionViewHeader request={createRequest()} />)

        fireEvent.click(screen.getByText('https://test-dapp.com'))

        expect(mockPushWebView).toHaveBeenCalledWith({
            id: 'mock-id',
            url: 'https://test-dapp.com',
        })
    })

    test('does not render URL button when URL is empty', () => {
        const request = createRequest({
            peerMeta: {
                name: 'Test dApp',
                url: '',
                icons: [],
                description: '',
            },
        } as Partial<WalletConnectSessionRequest>)

        render(<ConnectionViewHeader request={request} />)

        // URL button should not be rendered - only the title text should appear
        const buttons = screen.queryAllByRole('button')
        const urlButton = buttons.find(b => b.textContent === '')
        expect(urlButton).toBeUndefined()
    })

    test('displays permissions and accounts section titles', () => {
        render(<ConnectionViewHeader request={createRequest()} />)

        expect(
            screen.getByText('walletconnect.request.permissions_title'),
        ).toBeDefined()
        expect(
            screen.getByText('walletconnect.request.accounts_title'),
        ).toBeDefined()
    })
})
