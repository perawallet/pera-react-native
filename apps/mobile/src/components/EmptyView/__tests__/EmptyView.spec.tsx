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
import { render, screen } from '@test-utils/render'
import { Text } from 'react-native'
import { EmptyView } from '../EmptyView'

vi.mock('@components/LoadingView', () => ({
    LoadingView: () => <div data-testid='loading-view' />,
}))

describe('EmptyView', () => {
    it('renders title and body correctly', () => {
        render(
            <EmptyView
                title='Empty Title'
                body='Empty Body'
            />,
        )
        expect(screen.getByText('Empty Title')).toBeTruthy()
        expect(screen.getByText('Empty Body')).toBeTruthy()
    })

    it('caps the body at 3 lines by default', () => {
        render(<EmptyView body='Empty Body' />)
        const element = screen.getByText('Empty Body')
        expect(element.getAttribute('numberoflines')).toBe('3')
    })

    it('renders the full body when shouldTruncateBody is false', () => {
        render(
            <EmptyView
                body='Empty Body'
                shouldTruncateBody={false}
            />,
        )
        const element = screen.getByText('Empty Body')
        expect(element.getAttribute('numberoflines')).toBeNull()
    })

    it('renders button if provided', () => {
        render(
            <EmptyView
                body='Test'
                button={<Text>Action</Text>}
            />,
        )
        expect(screen.getByText('Action')).toBeTruthy()
    })

    it('renders default loading view when isLoading is true', () => {
        render(
            <EmptyView
                isLoading
                body='Empty Body'
            />,
        )
        expect(screen.getByTestId('loading-view')).toBeTruthy()
        expect(screen.queryByText('Empty Body')).toBeNull()
    })

    it('renders custom loadingView when isLoading is true and loadingView is provided', () => {
        render(
            <EmptyView
                isLoading
                body='Empty Body'
                loadingView={<Text>Custom Loading</Text>}
            />,
        )
        expect(screen.getByText('Custom Loading')).toBeTruthy()
        expect(screen.queryByText('Empty Body')).toBeNull()
        expect(screen.queryByTestId('loading-view')).toBeNull()
    })

    it('renders empty content when isLoading is false', () => {
        render(
            <EmptyView
                isLoading={false}
                title='Empty Title'
                body='Empty Body'
            />,
        )
        expect(screen.getByText('Empty Title')).toBeTruthy()
        expect(screen.getByText('Empty Body')).toBeTruthy()
    })
})
