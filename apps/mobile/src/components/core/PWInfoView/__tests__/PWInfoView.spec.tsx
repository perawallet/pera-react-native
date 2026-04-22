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
import { Text } from 'react-native'
import { PWInfoView } from '../PWInfoView'

describe('PWInfoView', () => {
    it('renders title, body, and illustration slot', () => {
        render(
            <PWInfoView
                illustration={<Text>illustration-slot</Text>}
                title='Welcome'
                body='Get started by creating an account.'
                primaryAction={{ label: 'Continue', onPress: vi.fn() }}
            />,
        )

        expect(screen.getByText('Welcome')).toBeTruthy()
        expect(
            screen.getByText('Get started by creating an account.'),
        ).toBeTruthy()
        expect(screen.getByText('illustration-slot')).toBeTruthy()
    })

    it('invokes primaryAction.onPress when the primary button is pressed', () => {
        const onPress = vi.fn()
        const { container } = render(
            <PWInfoView
                title='Welcome'
                body='Body'
                primaryAction={{
                    label: 'Continue',
                    onPress,
                    testID: 'primary-btn',
                }}
            />,
        )

        const primary = container.querySelector('[testid="primary-btn"]')
        expect(primary).toBeTruthy()
        fireEvent.click(primary!)
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('invokes secondaryAction.onPress when the secondary button is pressed', () => {
        const onSecondary = vi.fn()
        const { container } = render(
            <PWInfoView
                title='Welcome'
                body='Body'
                primaryAction={{ label: 'Continue', onPress: vi.fn() }}
                secondaryAction={{
                    label: 'Cancel',
                    onPress: onSecondary,
                    testID: 'secondary-btn',
                }}
            />,
        )

        const secondary = container.querySelector('[testid="secondary-btn"]')
        fireEvent.click(secondary!)
        expect(onSecondary).toHaveBeenCalledTimes(1)
    })

    it('renders footerExtras above the primary action', () => {
        render(
            <PWInfoView
                title='Warning'
                body='Pay attention.'
                footerExtras={<Text>warning-row</Text>}
                primaryAction={{ label: 'OK', onPress: vi.fn() }}
            />,
        )

        expect(screen.getByText('warning-row')).toBeTruthy()
    })
})
