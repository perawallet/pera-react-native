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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import type { Banner } from '@perawallet/wallet-core-banners'
import { CompactBanner } from '../CompactBanner'

const banner: Banner = {
    id: 1,
    type: 'governance',
    title: 'Vote in Period 12',
    subtitle: null,
    buttonLabel: null,
    buttonUrl: null,
    isButtonUrlExternal: false,
    autoOpenMode: null,
    backgroundImageUrl: null,
}

describe('CompactBanner', () => {
    it('renders the title text', () => {
        render(
            <CompactBanner
                primary={banner}
                additionalCount={0}
                onPress={() => undefined}
            />,
        )
        expect(screen.getByText('Vote in Period 12')).toBeTruthy()
    })

    it('falls back to subtitle when no title is present', () => {
        render(
            <CompactBanner
                primary={{ ...banner, title: null, subtitle: 'Sub' }}
                additionalCount={0}
                onPress={() => undefined}
            />,
        )
        expect(screen.getByText('Sub')).toBeTruthy()
    })

    it('hides the +N pill when additionalCount is 0', () => {
        render(
            <CompactBanner
                primary={banner}
                additionalCount={0}
                onPress={() => undefined}
            />,
        )
        expect(screen.queryByTestId('compact_banner_more_badge')).toBeNull()
    })

    it('shows the +N pill when additionalCount > 0', () => {
        render(
            <CompactBanner
                primary={banner}
                additionalCount={3}
                onPress={() => undefined}
            />,
        )
        const label = screen.getByTestId('compact_banner_more_badge')
        expect(label).toBeTruthy()
        expect(screen.getByText('+3')).toBeTruthy()
    })

    it('fires onPress when tapped', () => {
        const onPress = vi.fn()
        render(
            <CompactBanner
                primary={banner}
                additionalCount={0}
                onPress={onPress}
            />,
        )
        fireEvent.click(screen.getByTestId('compact_banner'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})
