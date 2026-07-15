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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { PWResultView } from '../PWResultView'

describe('PWResultView', () => {
    it('renders title and body for the error variant', () => {
        render(
            <PWResultView
                variant='error'
                title='Something went wrong'
                body='Please try again.'
            />,
        )

        expect(screen.getByText('Something went wrong')).toBeTruthy()
        expect(screen.getByText('Please try again.')).toBeTruthy()
    })

    it('renders only title when body is omitted', () => {
        render(
            <PWResultView
                variant='success'
                title='Done'
            />,
        )

        expect(screen.getByText('Done')).toBeTruthy()
    })

    it('invokes primaryAction.onPress when primary button is pressed', () => {
        const onPrimary = vi.fn()
        const { container } = render(
            <PWResultView
                variant='error'
                title='Oops'
                primaryAction={{ label: 'Retry', onPress: onPrimary }}
            />,
        )

        const primary = container.querySelector(
            '[testid="pw-result-view-primary"]',
        )
        expect(primary).toBeTruthy()
        fireEvent.click(primary!)
        expect(onPrimary).toHaveBeenCalledTimes(1)
    })

    it('invokes secondaryAction.onPress when secondary button is pressed', () => {
        const onSecondary = vi.fn()
        const { container } = render(
            <PWResultView
                variant='error'
                title='Oops'
                secondaryAction={{ label: 'Cancel', onPress: onSecondary }}
            />,
        )

        const secondary = container.querySelector(
            '[testid="pw-result-view-secondary"]',
        )
        fireEvent.click(secondary!)
        expect(onSecondary).toHaveBeenCalledTimes(1)
    })

    it('renders custom children between body and actions', () => {
        render(
            <PWResultView
                variant='warning'
                title='Heads up'
                body='Double-check before continuing.'
            >
                <Text>extra-content</Text>
            </PWResultView>,
        )

        expect(screen.getByText('extra-content')).toBeTruthy()
    })

    it('hides the footer when no actions are provided', () => {
        const { container } = render(
            <PWResultView
                variant='error'
                title='Oops'
            />,
        )

        expect(
            container.querySelector('[testid="pw-result-view-primary"]'),
        ).toBeNull()
        expect(
            container.querySelector('[testid="pw-result-view-secondary"]'),
        ).toBeNull()
    })
})
