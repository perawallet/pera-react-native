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

import { render, screen, fireEvent } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import { AccountErrorBoundary } from '../AccountErrorBoundary'
import { Text, View } from 'react-native'

// Mock BaseErrorBoundary since we want to test AccountErrorBoundary specifically
// But wait, it's a wrapper. Integration test is fine.
// Actually, BaseErrorBoundary relies on logging.
vi.mock('@components/BaseErrorBoundary', () => ({
    BaseErrorBoundary: ({ children, fallback }: any) => {
        // Render children
        return <View>{children}</View>
    },
}))

describe('AccountErrorBoundary', () => {
    it('renders children', () => {
        const t = vi.fn(key => key)
        render(
            <AccountErrorBoundary t={t}>
                <Text>Child Content</Text>
            </AccountErrorBoundary>,
        )
        expect(screen.getByText('Child Content')).toBeTruthy()
    })
})
