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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import {
    NavigationHeader,
    type NavigationHeaderProps,
} from '../NavigationHeader'

const mockProps = {
    navigation: {
        canGoBack: () => true,
        goBack: vi.fn(),
    },
    route: {
        key: 'test-key',
        name: 'Test Screen',
    },
    options: {
        headerShown: true,
        title: 'Test Title',
    },
} as unknown as NavigationHeaderProps

describe('NavigationHeader', () => {
    it('renders title from options', () => {
        render(<NavigationHeader {...mockProps} />)
        expect(screen.getByText('Test Title')).toBeTruthy()
    })

    it('prioritizes headerTitle over title', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
                title: 'Ignored Title',
                headerTitle: 'Priority Title',
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.getByText('Priority Title')).toBeTruthy()
        expect(screen.queryByText('Ignored Title')).toBeNull()
    })

    it('renders empty title when headerTitle is empty string', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
                title: 'Ignored Title',
                headerTitle: '',
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        // Should not render "Ignored Title" or "Test Screen"
        expect(screen.queryByText('Ignored Title')).toBeNull()
        expect(screen.queryByText('Test Screen')).toBeNull()
    })

    it('renders nothing when headerShown is false', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: false,
                title: 'Hidden Title',
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.queryByText('Hidden Title')).toBeNull()
    })

    it('renders nothing when options are undefined', () => {
        const props = {
            ...mockProps,
            options: undefined,
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.queryByText('Test Screen')).toBeNull()
    })

    it('falls back to route name when no title in options', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.getByText('Test Screen')).toBeTruthy()
    })

    it('translates dot-notation title keys', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
                title: 'screens.contacts',
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        // t() returns the key in test env (no i18next instance)
        expect(screen.getByText('screens.contacts')).toBeTruthy()
    })

    it('renders headerTitle function result', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
                title: 'Original',
                headerTitle: ({ children }: { children: string }) => (
                    <Text>{`Custom: ${children}`}</Text>
                ),
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.getByText('Custom: Original')).toBeTruthy()
        expect(screen.queryByText('Original')).toBeNull()
    })

    it('renders custom headerLeft', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
                title: 'Test',
                headerLeft: () => <Text>Custom Back</Text>,
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.getByText('Custom Back')).toBeTruthy()
    })

    it('renders custom headerRight', () => {
        const props = {
            ...mockProps,
            options: {
                headerShown: true,
                title: 'Test',
                headerRight: () => <Text>Action Button</Text>,
            },
        } as unknown as NavigationHeaderProps
        render(<NavigationHeader {...props} />)
        expect(screen.getByText('Action Button')).toBeTruthy()
    })
})
