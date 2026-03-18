import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import {
    ManageAssetsBottomSheet,
    ManageAssetsBottomSheetProps,
} from '../ManageAssetsBottomSheet'

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) => (isVisible ? <div data-testid='PWBottomSheet'>{children}</div> : null),
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

const defaultProps: ManageAssetsBottomSheetProps = {
    isVisible: true,
    onClose: vi.fn(),
    onOpenSort: vi.fn(),
    onOpenFilter: vi.fn(),
    onRemoveAssets: vi.fn(),
    isWatchAccount: false,
}

const renderComponent = (overrides: Partial<ManageAssetsBottomSheetProps> = {}) =>
    render(<ManageAssetsBottomSheet {...defaultProps} {...overrides} />)

describe('ManageAssetsBottomSheet', () => {
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
