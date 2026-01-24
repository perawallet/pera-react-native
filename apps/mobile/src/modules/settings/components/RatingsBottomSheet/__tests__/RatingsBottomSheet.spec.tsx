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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen } from '@test-utils/render'
import { RatingsBottomSheet } from '../RatingsBottomSheet'
import RateApp from 'react-native-rate-app'

vi.mock('react-native-rate-app', () => ({
    default: {
        openStoreForReview: vi.fn().mockResolvedValue(undefined),
    },
    AndroidMarket: {
        GOOGLE: 'google',
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useDeviceInfoService: () => ({
        getAppPackage: () => 'com.algorand.android',
        getAppId: () => '1459898525',
    }),
}))

describe('RatingsBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders title and body text when open', () => {
        render(
            <RatingsBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByText('settings.rating.title')).toBeTruthy()
        expect(screen.getByText('settings.rating.body')).toBeTruthy()
    })

    it('renders thumb up and thumb down buttons', () => {
        render(
            <RatingsBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        // RoundButtons with icons should be present
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('opens store for review and closes when thumb up is pressed', async () => {
        render(
            <RatingsBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        const buttons = screen.getAllByRole('button')
        await fireEvent.click(buttons[0])

        expect(RateApp.openStoreForReview).toHaveBeenCalledWith({
            androidPackageName: 'com.algorand.android',
            iOSAppId: '1459898525',
            androidMarket: 'google',
        })
        expect(mockOnClose).toHaveBeenCalled()
    })

    it('opens store for review and closes when thumb down is pressed', async () => {
        render(
            <RatingsBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        const buttons = screen.getAllByRole('button')
        await fireEvent.click(buttons[1])

        expect(RateApp.openStoreForReview).toHaveBeenCalled()
        expect(mockOnClose).toHaveBeenCalled()
    })
})
