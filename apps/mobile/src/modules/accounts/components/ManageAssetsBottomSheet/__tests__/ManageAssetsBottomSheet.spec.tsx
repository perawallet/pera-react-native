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

import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import {
    ManageAssetsContent,
    ManageAssetsContentProps,
} from '../ManageAssetsBottomSheet'

vi.mock('@components/core', () => ({
    PWToolbar: () => <div data-testid='PWToolbar' />,
    PWIcon: ({ name }: { name: string }) => (
        <div data-testid={`PWIcon-${name}`} />
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children }: any) => <span>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style }: any) => <div style={style}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress, testID }: any) => (
        <button
            onClick={onPress}
            data-testid={testID}
        >
            {children}
        </button>
    ),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const defaultProps: ManageAssetsContentProps = {
    onClose: vi.fn(),
    onOpenSort: vi.fn(),
    onOpenFilter: vi.fn(),
    onRemoveAssets: vi.fn(),
    isWatchAccount: false,
}

const renderComponent = (overrides: Partial<ManageAssetsContentProps> = {}) =>
    render(
        <ManageAssetsContent
            {...defaultProps}
            {...overrides}
        />,
    )

describe('ManageAssetsContent', () => {
    it('renders sort option', () => {
        // Arrange & Act
        renderComponent()

        // Assert
        expect(screen.getByTestId('manage_assets_sort')).toBeTruthy()
    })

    it('renders filter option', () => {
        // Arrange & Act
        renderComponent()

        // Assert
        expect(screen.getByTestId('manage_assets_filter')).toBeTruthy()
    })

    it('renders remove assets option for non-watch accounts', () => {
        // Arrange & Act
        renderComponent({ isWatchAccount: false })

        // Assert
        expect(screen.getByTestId('manage_assets_remove')).toBeTruthy()
    })

    it('hides remove assets option for watch accounts', () => {
        // Arrange & Act
        renderComponent({ isWatchAccount: true })

        // Assert
        expect(screen.queryByTestId('manage_assets_remove')).toBeNull()
    })

    it('calls onOpenSort when sort option is pressed', () => {
        // Arrange
        const onOpenSort = vi.fn()
        renderComponent({ onOpenSort })

        // Act
        fireEvent.click(screen.getByTestId('manage_assets_sort'))

        // Assert
        expect(onOpenSort).toHaveBeenCalledOnce()
    })

    it('calls onOpenFilter when filter option is pressed', () => {
        // Arrange
        const onOpenFilter = vi.fn()
        renderComponent({ onOpenFilter })

        // Act
        fireEvent.click(screen.getByTestId('manage_assets_filter'))

        // Assert
        expect(onOpenFilter).toHaveBeenCalledOnce()
    })

    it('calls onRemoveAssets when remove option is pressed', () => {
        // Arrange
        const onRemoveAssets = vi.fn()
        renderComponent({ onRemoveAssets, isWatchAccount: false })

        // Act
        fireEvent.click(screen.getByTestId('manage_assets_remove'))

        // Assert
        expect(onRemoveAssets).toHaveBeenCalledOnce()
    })
})
