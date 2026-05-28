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

import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWCallout } from '../PWCallout'

describe('PWCallout', () => {
    it('renders the title and body', () => {
        render(
            <PWCallout
                title='Strong biometric required'
                body='Add a fingerprint or face unlock to use passkeys.'
            />,
        )

        expect(screen.getByText('Strong biometric required')).toBeTruthy()
        expect(
            screen.getByText(
                'Add a fingerprint or face unlock to use passkeys.',
            ),
        ).toBeTruthy()
    })

    it('defaults to the info icon', () => {
        render(
            <PWCallout
                title='Heads up'
                body='Something to know.'
            />,
        )

        expect(screen.getByTestId('icon-info')).toBeTruthy()
    })

    it('renders a caller-supplied icon instead of the default', () => {
        render(
            <PWCallout
                icon='trash'
                title='Heads up'
                body='Something to know.'
            />,
        )

        expect(screen.getByTestId('icon-trash')).toBeTruthy()
        expect(screen.queryByTestId('icon-info')).toBeFalsy()
    })

    it('forwards the testID to the container so callers can target it', () => {
        render(
            <PWCallout
                title='Heads up'
                body='Something to know.'
                testID='my-callout'
            />,
        )

        expect(screen.getByTestId('my-callout')).toBeTruthy()
    })
})
