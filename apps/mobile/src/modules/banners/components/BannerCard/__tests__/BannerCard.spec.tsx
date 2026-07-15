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
import type { Banner } from '@perawallet/wallet-core-banners'
import { BannerCard } from '../BannerCard'

const banner: Banner = {
    id: '1',
    type: 'staking',
    title: 'Stake your ALGOs',
    subtitle: 'Earn yield',
    buttonLabel: 'Start staking',
    buttonUrl: 'pera://staking',
    isButtonUrlExternal: false,
    autoOpenMode: null,
    backgroundImageUrl: null,
}

describe('BannerCard', () => {
    it('renders title and subtitle', () => {
        render(
            <BannerCard
                banner={banner}
                onPressCTA={() => undefined}
                onDismiss={() => undefined}
            />,
        )
        expect(screen.getByText('Stake your ALGOs')).toBeTruthy()
        expect(screen.getByText('Earn yield')).toBeTruthy()
    })

    it('renders the CTA button when both label and URL are present', () => {
        render(
            <BannerCard
                banner={banner}
                onPressCTA={() => undefined}
                onDismiss={() => undefined}
            />,
        )
        expect(screen.getByTestId('banner_card_cta')).toBeTruthy()
        expect(screen.getByText('Start staking')).toBeTruthy()
    })

    it('hides the CTA when buttonUrl is missing', () => {
        render(
            <BannerCard
                banner={{ ...banner, buttonUrl: null }}
                onPressCTA={() => undefined}
                onDismiss={() => undefined}
            />,
        )
        expect(screen.queryByTestId('banner_card_cta')).toBeNull()
    })

    it('fires onPressCTA with the banner when CTA tapped', () => {
        const onPressCTA = vi.fn()
        render(
            <BannerCard
                banner={banner}
                onPressCTA={onPressCTA}
                onDismiss={() => undefined}
            />,
        )
        fireEvent.click(screen.getByTestId('banner_card_cta'))
        expect(onPressCTA).toHaveBeenCalledWith(banner)
    })

    it('fires onDismiss with the banner when dismiss tapped', () => {
        const onDismiss = vi.fn()
        render(
            <BannerCard
                banner={banner}
                onPressCTA={() => undefined}
                onDismiss={onDismiss}
            />,
        )
        fireEvent.click(screen.getByTestId('banner_card_dismiss'))
        expect(onDismiss).toHaveBeenCalledWith(banner)
    })

    it('hides the dismiss button when isDismissable=false', () => {
        render(
            <BannerCard
                banner={banner}
                isDismissable={false}
                onPressCTA={() => undefined}
                onDismiss={() => undefined}
            />,
        )
        expect(screen.queryByTestId('banner_card_dismiss')).toBeNull()
    })
})
