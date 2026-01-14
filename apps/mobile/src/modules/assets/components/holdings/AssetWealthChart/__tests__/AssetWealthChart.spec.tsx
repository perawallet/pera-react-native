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

import { render, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import AssetWealthChart from '../AssetWealthChart'

vi.mock('@components/WealthChart', () => ({
    default: 'WealthChart',
}))

const mockAccount: any = { address: 'test' }
const mockAsset: any = { assetId: 123 }

describe('AssetWealthChart', () => {
    it('renders correctly', () => {
        const onSelectionChanged = vi.fn()
        render(
            <AssetWealthChart
                account={mockAccount}
                asset={mockAsset}
                period='one-week'
                onSelectionChanged={onSelectionChanged}
            />,
        )
        expect(screen.toJSON()).toBeDefined()
    })
})
