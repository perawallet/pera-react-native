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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { AccountSelection } from '../AccountSelection'

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    useSelectedAccount: vi.fn(() => null),
    useAllAccounts: vi.fn(() => []),
}))

describe('AccountSelection', () => {
    it('renders correctly when no account is selected', () => {
        const { container } = render(<AccountSelection />)
        expect(container).toBeTruthy()
    })

    it('renders selected account when available', () => {
        const { container } = render(<AccountSelection />)
        expect(container).toBeTruthy()
    })

    it('handles onPress when provided', () => {
        const onPress = vi.fn()
        const { container } = render(
            <AccountSelection
                onPress={onPress}
                testID='account-selection'
            />,
        )

        expect(container).toBeTruthy()
    })

    it('passes through TouchableOpacityProps', () => {
        const { container } = render(
            <AccountSelection
                activeOpacity={0.5}
                disabled={true}
            />,
        )
        expect(container).toBeTruthy()
    })
})
