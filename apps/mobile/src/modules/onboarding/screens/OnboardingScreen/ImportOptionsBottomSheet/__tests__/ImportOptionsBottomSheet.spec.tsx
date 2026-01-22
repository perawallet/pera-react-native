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

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

describe('ImportOptionsBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onHDWalletPress: vi.fn(),
        onAlgo25Press: vi.fn(),
    }

    it('renders correctly when visible', () => {
        render(<ImportOptionsBottomSheet {...defaultProps} />)

        expect(screen.getByText('onboarding.import_options.title')).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_options.universal_wallet.title',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_options.algo25.title'),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_options.universal_wallet.description',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_options.algo25.description'),
        ).toBeTruthy()
        expect(
            screen.getAllByText('onboarding.import_options.mnemonic_info'),
        ).toHaveLength(2)
    })

    it('does not render content when not visible', () => {
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )

        expect(screen.queryByText('onboarding.import_options.title')).toBeNull()
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

    it('calls onHDWalletPress when Universal Wallet option is pressed', () => {
        const onHDWalletPress = vi.fn()
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                onHDWalletPress={onHDWalletPress}
            />,
        )

        fireEvent.click(
            screen.getByText(
                'onboarding.import_options.universal_wallet.title',
            ),
        )
        expect(onHDWalletPress).toHaveBeenCalledTimes(1)
    })

    it('calls onAlgo25Press when ALGO25 option is pressed', () => {
        const onAlgo25Press = vi.fn()
        render(
            <ImportOptionsBottomSheet
                {...defaultProps}
                onAlgo25Press={onAlgo25Press}
            />,
        )

        fireEvent.click(
            screen.getByText('onboarding.import_options.algo25.title'),
        )
        expect(onAlgo25Press).toHaveBeenCalledTimes(1)
    })
})
