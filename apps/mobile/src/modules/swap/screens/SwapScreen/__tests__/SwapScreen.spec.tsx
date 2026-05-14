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
import { type Optional } from '@perawallet/wallet-core-shared'
import { render, screen, waitFor } from '@test-utils/render'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SwapScreen } from '../SwapScreen'

const mockUseSwapIntroduction = vi.hoisted(() => vi.fn())
const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

const mockSetFromAsset = vi.hoisted(() => vi.fn())
const mockSetToAsset = vi.hoisted(() => vi.fn())
const mockRouteParams = vi.hoisted(() => ({
    current: undefined as Optional<Record<string, Optional<string>>>,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAllAccounts: vi.fn(() => ({})),
        isSigningAccount: vi.fn(() => true),
    }
})

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useRoute: () => ({
            params: mockRouteParams.current,
        }),
    }
})

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({
        fromAsset: '0',
        toAsset: '31566704',
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
    }),
}))

vi.mock('@modules/swap/hooks', () => ({
    useSwapIntroduction: mockUseSwapIntroduction,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@modules/swap/components', () => ({
    SwapForm: () => <div data-testid='swap-form' />,
    SwapIntroductionContent: () => null,
}))

vi.mock('@modules/accounts/components/AccountSelection', () => ({
    AccountSelection: () => <div data-testid='account-selection' />,
}))

describe('SwapScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams.current = undefined
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it('requests the introduction sheet when user has not seen it', async () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: false,
            markIntroductionSeen: vi.fn(),
        })

        render(<SwapScreen />)

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalled()
        })
    })

    it('renders account selection', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: true,
            markIntroductionSeen: vi.fn(),
        })

        render(<SwapScreen />)

        expect(screen.getByTestId('account-selection')).toBeTruthy()
    })

    it('does not request the introduction sheet when user has already seen it', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: true,
            markIntroductionSeen: vi.fn(),
        })

        render(<SwapScreen />)

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(screen.getByTestId('swap-form')).toBeTruthy()
    })

    it('sets swap assets from route params', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: true,
            markIntroductionSeen: vi.fn(),
        })
        mockRouteParams.current = { assetInId: '0', assetOutId: '12345' }

        render(<SwapScreen />)

        expect(mockSetFromAsset).toHaveBeenCalledWith('0')
        expect(mockSetToAsset).toHaveBeenCalledWith('12345')
    })

    it('does not set swap assets when no route params', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: true,
            markIntroductionSeen: vi.fn(),
        })

        render(<SwapScreen />)

        expect(mockSetFromAsset).not.toHaveBeenCalled()
        expect(mockSetToAsset).not.toHaveBeenCalled()
    })

    it('only sets provided params when partial route params given', () => {
        mockUseSwapIntroduction.mockReturnValue({
            isIntroductionSeen: true,
            markIntroductionSeen: vi.fn(),
        })
        mockRouteParams.current = { assetOutId: '67890' }

        render(<SwapScreen />)

        expect(mockSetFromAsset).not.toHaveBeenCalled()
        expect(mockSetToAsset).toHaveBeenCalledWith('67890')
    })
})
