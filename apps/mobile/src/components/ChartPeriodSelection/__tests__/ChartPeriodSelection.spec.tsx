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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import ChartPeriodSelection from '../ChartPeriodSelection'

describe('ChartPeriodSelection', () => {
    it('renders all period options', () => {
        const onChange = vi.fn()
        render(
            <ChartPeriodSelection
                value='one-week'
                onChange={onChange}
            />,
        )

        expect(screen.getByText('chart.one_week.label')).toBeTruthy()
        expect(screen.getByText('chart.one_month.label')).toBeTruthy()
        expect(screen.getByText('chart.one_year.label')).toBeTruthy()
    })

    it('calls onChange when a new period is selected', () => {
        const onChange = vi.fn()
        render(
            <ChartPeriodSelection
                value='one-week'
                onChange={onChange}
            />,
        )

        fireEvent.click(screen.getByText('chart.one_month.label'))
        expect(onChange).toHaveBeenCalledWith('one-month')
    })
})
