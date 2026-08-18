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

// expo-audio is a native module vitest.setup does not stub (unlike expo-video);
// these specs never render audio media, so import-safety is all that's needed.
vi.mock('expo-audio', () => ({
    useAudioPlayer: () => ({}),
    useAudioPlayerStatus: () => ({}),
}))

import { MediaCarousel } from '../MediaCarousel'

describe('MediaCarousel', () => {
    it('renders the image when a preview url is available', () => {
        render(
            <MediaCarousel
                media={[
                    {
                        type: 'image',
                        previewUrl: 'https://example.test/nft.png',
                    },
                ]}
            />,
        )

        expect(screen.getByTestId('PWImage')).toBeTruthy()
        expect(screen.queryByTestId('icon-image-off')).toBeNull()
    })

    it('falls back to the placeholder when the image fails to load', () => {
        render(
            <MediaCarousel
                media={[
                    {
                        type: 'image',
                        previewUrl: 'https://example.test/nft.png',
                    },
                ]}
            />,
        )

        fireEvent.error(screen.getByTestId('PWImage'))

        expect(screen.getByTestId('icon-image-off')).toBeTruthy()
        expect(screen.queryByTestId('PWImage')).toBeNull()
    })
})
