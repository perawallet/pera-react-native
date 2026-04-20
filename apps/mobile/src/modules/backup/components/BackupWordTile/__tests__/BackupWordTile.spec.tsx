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
import { BackupWordTile } from '../BackupWordTile'

describe('BackupWordTile', () => {
    test('renders word text', () => {
        render(<BackupWordTile word='alpha' onPress={() => {}} />)
        expect(screen.getByText('alpha')).toBeTruthy()
    })

    test('calls onPress when tapped', () => {
        const onPress = vi.fn()
        render(<BackupWordTile word='alpha' onPress={onPress} />)
        fireEvent.click(screen.getByText('alpha'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    test('renders in error state when hasError is true', () => {
        render(
            <BackupWordTile
                word='alpha'
                onPress={() => {}}
                hasError
                testID='tile'
            />,
        )
        const tile = screen.getByTestId('tile')
        expect(tile.getAttribute('aria-invalid')).toBe('true')
    })
})
