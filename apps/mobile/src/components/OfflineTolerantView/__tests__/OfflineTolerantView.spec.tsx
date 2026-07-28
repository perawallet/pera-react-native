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

import React from 'react'
import { Text } from 'react-native'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { OfflineTolerantView } from '../OfflineTolerantView'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const Children = () => <Text>children-content</Text>

describe('OfflineTolerantView', () => {
    it('renders children when online and healthy', () => {
        render(
            <OfflineTolerantView isOffline={false}>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('children-content')).toBeTruthy()
        expect(screen.queryByText('common.offline_mode')).toBeNull()
    })

    it('replaces children with the offline surface when offline', () => {
        render(
            <OfflineTolerantView isOffline>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.offline_mode')).toBeTruthy()
        expect(screen.getByText('common.offline_refresh_body')).toBeTruthy()
        expect(screen.queryByText('children-content')).toBeNull()
    })

    it('shows the error surface when the request failed while online', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isError
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.error.title')).toBeTruthy()
        expect(screen.queryByText('children-content')).toBeNull()
    })

    it('prefers the offline surface over the error surface', () => {
        render(
            <OfflineTolerantView
                isOffline
                isError
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.offline_mode')).toBeTruthy()
        expect(screen.queryByText('common.error.title')).toBeNull()
    })

    it('leaves the error arm to the caller when isError is not passed', () => {
        render(
            <OfflineTolerantView isOffline={false}>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('children-content')).toBeTruthy()
    })

    it('renders no retry button when no handler is given', () => {
        render(
            <OfflineTolerantView isOffline>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.queryByText('common.retry.label')).toBeNull()
    })

    it('calls onRetry from the offline surface', () => {
        const onRetry = vi.fn()
        render(
            <OfflineTolerantView
                isOffline
                onRetry={onRetry}
            >
                <Children />
            </OfflineTolerantView>,
        )

        fireEvent.click(screen.getByText('common.retry.label'))

        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('uses the surface-specific retry label and error body when provided', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isError
                onRetry={vi.fn()}
                retryLabel='staking.retry'
                errorBody='custom-error-body'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('staking.retry')).toBeTruthy()
        expect(screen.getByText('custom-error-body')).toBeTruthy()
    })

    it('applies the per-arm testIDs', () => {
        const { rerender } = render(
            <OfflineTolerantView
                isOffline
                offlineTestID='surface-offline'
                errorTestID='surface-error'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByTestId('surface-offline')).toBeTruthy()

        rerender(
            <OfflineTolerantView
                isOffline={false}
                isError
                offlineTestID='surface-offline'
                errorTestID='surface-error'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByTestId('surface-error')).toBeTruthy()
    })
})
