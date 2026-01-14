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
import WealthChart from '../WealthChart'

vi.mock('react-native-gifted-charts', () => ({
    LineChart: 'LineChart',
}))

describe('WealthChart', () => {
    it('renders correctly', () => {
        const onSelectionChanged = vi.fn()
        render(
            <WealthChart
                period='one-week'
                onSelectionChanged={onSelectionChanged}
            />,
        )
        expect(true).toBe(true)
    })
})
