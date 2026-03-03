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
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { MessagesScreen } from '../MessagesScreen'
import { useRoute } from '@react-navigation/native'

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useRoute: vi.fn(() => ({
            params: undefined,
            key: 'Messages',
            name: 'Messages',
        })),
    }
})

vi.mock('@components/core/PWTabView/PWTabView', () => ({
    createPWTabNavigator: () => ({
        Navigator: ({
            children,
            initialRouteName,
        }: {
            children: React.ReactNode
            initialRouteName?: string
        }) => (
            <div
                data-testid='tab-navigator'
                data-initial={initialRouteName}
            >
                {children}
            </div>
        ),
        Screen: ({
            name,
            component: Component,
        }: {
            name: string
            component: React.ComponentType
            options?: Record<string, unknown>
        }) => (
            <div data-testid={`tab-screen-${name}`}>
                <Component />
            </div>
        ),
    }),
}))

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxStatus: vi.fn(() => ({
        hasUnreadInboxItems: false,
        hasUnreadNotifications: false,
    })),
}))

vi.mock('@modules/messages/screens/NotificationsScreen', () => ({
    NotificationsScreen: () => <span data-testid='NotificationsScreen' />,
}))

vi.mock('@modules/messages/screens/InboxScreen', () => ({
    InboxScreen: () => <span data-testid='InboxScreen' />,
}))

vi.mock('@modules/messages/components/NotificationSettingsBottomSheet', () => ({
    NotificationSettingsBottomSheet: ({
        isVisible,
    }: {
        isVisible: boolean
    }) => (
        <span
            data-testid='NotificationSettingsBottomSheet'
            data-visible={isVisible}
        />
    ),
}))

describe('MessagesScreen', () => {
    it('renders both tab screens', () => {
        render(<MessagesScreen />)
        expect(screen.getByTestId('InboxScreen')).toBeTruthy()
        expect(screen.getByTestId('NotificationsScreen')).toBeTruthy()
    })

    it('passes initialTab as initialRouteName to navigator', () => {
        vi.mocked(useRoute).mockReturnValue({
            params: { initialTab: 'Notifications' },
            key: 'Messages',
            name: 'Messages',
        })

        render(<MessagesScreen />)
        expect(
            screen.getByTestId('tab-navigator').getAttribute('data-initial'),
        ).toBe('Notifications')
    })

    it('renders notification settings bottom sheet', () => {
        render(<MessagesScreen />)
        expect(
            screen.getByTestId('NotificationSettingsBottomSheet'),
        ).toBeTruthy()
    })
})
