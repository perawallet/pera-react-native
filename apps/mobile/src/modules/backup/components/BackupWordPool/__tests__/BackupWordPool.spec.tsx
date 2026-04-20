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
import { BackupWordPool } from '../BackupWordPool'

describe('BackupWordPool', () => {
    test('renders each pool word', () => {
        render(
            <BackupWordPool
                words={['alpha', 'bravo']}
                onTapWord={() => {}}
            />,
        )
        expect(screen.getByText('alpha')).toBeTruthy()
        expect(screen.getByText('bravo')).toBeTruthy()
    })

    test('calls onTapWord with word and index', () => {
        const onTapWord = vi.fn()
        render(
            <BackupWordPool
                words={['alpha', 'bravo']}
                onTapWord={onTapWord}
            />,
        )
        fireEvent.click(screen.getByText('bravo'))
        expect(onTapWord).toHaveBeenCalledWith('bravo', 1)
    })
})
