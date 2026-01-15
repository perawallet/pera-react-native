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

import React from 'react'
import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { SettingsWalletConnectDetailsScreen } from '../SettingsWalletConnectDetailsScreen'

vi.mock('@perawallet/wallet-core-walletconnect', async () => ({
    useWalletConnect: vi.fn(() => ({
        disconnect: vi.fn(),
    })),
    AlgorandPermission: {
        TX_PERMISSION: 'algo_signTxn',
        DATA_PERMISSION: 'algo_signData',
    },
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-core-shared', async () => ({
    formatDatetime: vi.fn().mockReturnValue('10/10/2020'),
}))

vi.mock('react-native-gesture-handler', () => ({
    ScrollView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock('@components/InfoButton', () => ({
    InfoButton: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock('@modules/walletconnect/components/PermissionItem', () => ({
    PermissionItem: () => <div>PermissionItem</div>,
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    AccountDisplay: () => <div>AccountDisplay</div>,
}))

vi.mock('@hooks/webview', () => ({
    useWebView: vi.fn(() => ({
        pushWebView: vi.fn(),
    })),
}))

vi.mock('@hooks/language', () => ({
    useLanguage: vi.fn(() => ({ t: (key: string) => key })),
}))

vi.mock('@components/core/PWButton', () => ({
    PWButton: ({ title }: { title: string }) => <button>{title}</button>,
}))

vi.mock('@components/core/PWView', () => ({
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock('@components/core/PWTouchableOpacity', () => ({
    PWTouchableOpacity: ({
        children,
        onPress,
    }: {
        children: React.ReactNode
        onPress: () => void
    }) => (
        <div
            onClick={onPress}
            role='button'
        >
            {children}
        </div>
    ),
}))

vi.mock('@components/RowTitledItem', () => ({
    RowTitledItem: ({
        title,
        children,
    }: {
        title: string
        children: React.ReactNode
    }) => (
        <div>
            {title}
            {children}
        </div>
    ),
}))

vi.mock('@components/ExpandablePanel/TitledExpandablePanel', () => ({
    TitledExpandablePanel: ({
        title,
        children,
    }: {
        title: string
        children: React.ReactNode
    }) => (
        <div>
            {title}
            {children}
        </div>
    ),
}))

vi.mock('@components/core/PWBadge', () => ({
    PWBadge: ({ value }: { value: string | number }) => <span>{value}</span>,
}))

vi.mock('@components/core/PWIcon', () => ({
    PWIcon: () => <div data-testid='pw-icon' />,
}))

const mockSession = {
    clientId: 'test-client-id',
    version: 2,
    createdAt: new Date(),
    session: {
        peerMeta: {
            name: 'Test DApp',
            url: 'https://test.com',
            description: 'A test decentralized application',
            icons: ['https://test.com/icon.png'],
        },
        accounts: ['test-address'],
        chainId: 4160,
        permissions: ['algo_signTxn'],
    },
}

const mockRoute = {
    params: { session: mockSession },
} as any // eslint-disable-line @typescript-eslint/no-explicit-any

const mockNavigation = {} as any // eslint-disable-line @typescript-eslint/no-explicit-any

// Mock the image component to avoid issues
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<typeof import('react-native')>()
    return {
        ...actual,
        Image: (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            props: any,
        ) => (
            <div
                data-testid='image'
                {...props}
            />
        ),
    }
})

describe('SettingsWalletConnectDetailsScreen', () => {
    it('renders session details with app name', () => {
        const { container } = render(
            <SettingsWalletConnectDetailsScreen
                route={mockRoute}
                navigation={mockNavigation}
            />,
        )
        expect(container.textContent).toContain('Test DApp')
    })

    it('displays session URL', () => {
        const { container } = render(
            <SettingsWalletConnectDetailsScreen
                route={mockRoute}
                navigation={mockNavigation}
            />,
        )
        expect(container.textContent).toContain('https://test.com')
    })

    it('shows delete button', () => {
        const { container } = render(
            <SettingsWalletConnectDetailsScreen
                route={mockRoute}
                navigation={mockNavigation}
            />,
        )
        // Check for text (likely 'Disconnect' or translated key)
        expect(container.textContent?.toLowerCase()).toMatch(
            /delete|disconnect/,
        )
    })

    it('displays version badge', () => {
        const { container } = render(
            <SettingsWalletConnectDetailsScreen
                route={mockRoute}
                navigation={mockNavigation}
            />,
        )
        expect(container.textContent).toContain('WCV2')
    })

    it('handles session without icon gracefully', () => {
        const sessionWithoutIcon = {
            ...mockSession,
            session: {
                ...mockSession.session,
                peerMeta: {
                    ...mockSession.session.peerMeta,
                    icons: undefined,
                },
            },
        }
        const routeWithoutIcon = {
            params: { session: sessionWithoutIcon },
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any

        const { container } = render(
            <SettingsWalletConnectDetailsScreen
                route={routeWithoutIcon}
                navigation={mockNavigation}
            />,
        )
        expect(container).toBeTruthy()
    })
})
