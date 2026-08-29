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
import { render, screen } from '@test-utils/render'
import { describe, expect, it, vi } from 'vitest'
import { PWRefreshControl } from '../PWRefreshControl'

vi.mock('@react-native-community/netinfo', () => ({
    default: { addEventListener: vi.fn() },
}))

// The global setup stubs RefreshControl to render nothing, which would hide the
// exact regression this file guards. Render children here so the forwarding is
// observable.
vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<typeof import('react-native')>()
    return {
        ...actual,
        RefreshControl: ({ children }: { children?: React.ReactNode }) =>
            React.createElement('div', { 'data-testid': 'refresh' }, children),
    }
})

describe('PWRefreshControl', () => {
    // Android's ScrollView renders a refresh control by cloning the element and
    // passing the scroll view itself as children. Swallowing them drops the whole
    // list from the tree — the crash behind/4681/4679.
    it('forwards children through to the underlying control', () => {
        render(
            <PWRefreshControl
                isRefreshing={false}
                onRefresh={vi.fn()}
            >
                <div data-testid='scroll-content' />
            </PWRefreshControl>,
        )

        expect(screen.getByTestId('scroll-content')).toBeTruthy()
    })
})
