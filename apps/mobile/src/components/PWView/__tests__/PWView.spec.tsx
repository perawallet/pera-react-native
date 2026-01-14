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

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import { Text } from 'react-native'
import PWView from '../PWView'

describe('PWView', () => {
    it('renders children correctly', () => {
        render(
            <PWView>
                <Text>Test Child</Text>
            </PWView>,
        )

        expect(screen.getByText('Test Child')).toBeTruthy()
    })

    it('passes extra props to the underlying View', () => {
        render(
            <PWView data-testid='pw-view'>
                <Text>Test</Text>
            </PWView>,
        )

        expect(screen.getByTestId('pw-view')).toBeTruthy()
    })
})
