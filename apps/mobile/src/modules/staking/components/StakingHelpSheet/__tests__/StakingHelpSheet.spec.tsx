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

import { fireEvent, render, screen } from '@test-utils/render'
import { describe, expect, it, vi } from 'vitest'
import { StakingHelpContent } from '../StakingHelpSheet'

vi.mock('@modules/webview', () => ({
    useWebView: vi.fn(() => ({
        pushWebView: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        algorandDefiUrl: 'https://algorand.co/ecosystem/defi',
    },
}))

describe('StakingHelpContent', () => {
    it('renders all three staking type rows when visible', () => {
        render(<StakingHelpContent onClose={vi.fn()} />)

        expect(screen.getByText('staking.type_liquid')).toBeTruthy()
        expect(screen.getByText('staking.type_pools')).toBeTruthy()
        expect(screen.getByText('staking.type_delegated')).toBeTruthy()
    })

    it('renders the sheet title', () => {
        render(<StakingHelpContent onClose={vi.fn()} />)

        expect(screen.getByText('staking.help.title')).toBeTruthy()
    })

    it('calls onClose when close icon is pressed', () => {
        const onClose = vi.fn()

        render(<StakingHelpContent onClose={onClose} />)

        fireEvent.click(screen.getByTestId('icon-cross'))

        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
