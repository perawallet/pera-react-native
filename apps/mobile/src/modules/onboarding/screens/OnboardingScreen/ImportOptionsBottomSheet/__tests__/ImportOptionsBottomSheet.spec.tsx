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

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { ImportOptionsBottomSheet } from '../ImportOptionsBottomSheet'

describe('ImportOptionsBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onUniversalWalletPress: vi.fn(),
        onAlgo25Press: vi.fn(),
    }

    it('renders correctly when visible', () => {
        render(<ImportOptionsBottomSheet {...defaultProps} />)

        expect(screen.getByText('Select your Mnemonic type')).toBeTruthy()
        expect(screen.getByText('Universal Wallet')).toBeTruthy()
        expect(screen.getByText('ALGO25')).toBeTruthy()
        expect(
            screen.getByText(
                'Wallet that lets you derive new accounts, all using the same mnemonic',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'Legacy format that is specific to Algorand ecosystem',
            ),
        ).toBeTruthy()
        expect(screen.getAllByText('24 words mnemonic keys')).toHaveLength(2)
    })

    it('does not render content when not visible', () => {
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )

        expect(screen.queryByText('Select your Mnemonic type')).toBeNull()
    })

    it('calls onClose when close button is pressed', () => {
        const onClose = vi.fn()
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                onClose={onClose}
            />,
        )

        fireEvent.click(screen.getByTestId('icon-cross'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onUniversalWalletPress when Universal Wallet option is pressed', () => {
        const onUniversalWalletPress = vi.fn()
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                onUniversalWalletPress={onUniversalWalletPress}
            />,
        )

        fireEvent.click(screen.getByText('Universal Wallet'))
        expect(onUniversalWalletPress).toHaveBeenCalledTimes(1)
    })

    it('calls onAlgo25Press when ALGO25 option is pressed', () => {
        const onAlgo25Press = vi.fn()
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                onAlgo25Press={onAlgo25Press}
            />,
        )

        fireEvent.click(screen.getByText('ALGO25'))
        expect(onAlgo25Press).toHaveBeenCalledTimes(1)
    })
})
