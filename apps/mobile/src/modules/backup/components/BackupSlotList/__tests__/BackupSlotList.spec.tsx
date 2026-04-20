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

import { describe, test, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { BackupSlotList } from '../BackupSlotList'

describe('BackupSlotList', () => {
    test('renders each slot with its 1-based index', () => {
        render(
            <BackupSlotList
                slots={[null, 'bravo', null]}
                onTapSlot={() => {}}
            />,
        )
        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('2')).toBeTruthy()
        expect(screen.getByText('3')).toBeTruthy()
        expect(screen.getByText('bravo')).toBeTruthy()
    })

    test('calls onTapSlot with the tapped slot index', () => {
        const onTapSlot = vi.fn()
        render(
            <BackupSlotList
                slots={[null, 'bravo', null]}
                onTapSlot={onTapSlot}
            />,
        )
        fireEvent.click(screen.getByText('bravo'))
        expect(onTapSlot).toHaveBeenCalledWith(1)
    })
})
