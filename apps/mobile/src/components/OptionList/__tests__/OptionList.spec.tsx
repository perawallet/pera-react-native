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

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { OptionList, type OptionListOption } from '../OptionList'

const options = (
    overrides: Partial<OptionListOption>[] = [],
): OptionListOption[] =>
    [
        { key: 'device', title: 'Device', onPress: vi.fn() },
        { key: 'drive', title: 'Google Drive', onPress: vi.fn() },
    ].map((option, index) => ({ ...option, ...overrides[index] }))

describe('OptionList', () => {
    it('renders a row per option', () => {
        render(<OptionList options={options()} />)

        expect(screen.getByText('Device')).toBeTruthy()
        expect(screen.getByText('Google Drive')).toBeTruthy()
    })

    it('calls only the pressed row’s handler', () => {
        const rows = options()
        render(<OptionList options={rows} />)

        fireEvent.click(screen.getByText('Google Drive'))

        expect(rows[1].onPress).toHaveBeenCalledTimes(1)
        expect(rows[0].onPress).not.toHaveBeenCalled()
    })

    // `key` is React's own prop: spreading it onto PanelButton would strip it
    // from the row and warn, so it has to be destructured out.
    it('keeps rows distinct when two share a title', () => {
        const rows = options([{ title: 'Same' }, { title: 'Same' }])
        render(<OptionList options={rows} />)

        fireEvent.click(screen.getAllByText('Same')[1])

        expect(rows[1].onPress).toHaveBeenCalledTimes(1)
        expect(rows[0].onPress).not.toHaveBeenCalled()
    })
})
