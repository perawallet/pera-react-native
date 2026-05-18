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

import { describe, test, expect } from 'vitest'
import {
    mapBannerResponse,
    mapSpotBannerResponse,
    hasRenderableContent,
} from '../mappers'

describe('mapBannerResponse', () => {
    test('maps full payload', () => {
        const result = mapBannerResponse({
            id: 1,
            type: 'governance',
            title: 'Vote',
            subtitle: 'Now',
            button_label: 'Go',
            button_url: 'pera://gov',
            button_web_url: 'https://gov',
            is_button_url_external: false,
            auto_open_mode: 'select',
            background_image: 'https://cdn.test/bg.png',
        })

        expect(result).toEqual({
            id: 1,
            type: 'governance',
            title: 'Vote',
            subtitle: 'Now',
            buttonLabel: 'Go',
            buttonUrl: 'pera://gov',
            isButtonUrlExternal: false,
            autoOpenMode: 'select',
            backgroundImageUrl: 'https://cdn.test/bg.png',
        })
    })

    test('coerces missing string fields to null', () => {
        const result = mapBannerResponse({
            id: 2,
            type: 'staking',
            is_button_url_external: true,
        })

        expect(result.title).toBeNull()
        expect(result.subtitle).toBeNull()
        expect(result.buttonLabel).toBeNull()
        expect(result.buttonUrl).toBeNull()
        expect(result.isButtonUrlExternal).toBe(true)
        expect(result.autoOpenMode).toBeNull()
        expect(result.backgroundImageUrl).toBeNull()
    })

    test('defaults isButtonUrlExternal to false when omitted', () => {
        const result = mapBannerResponse({
            id: 3,
            type: 'generic',
            is_button_url_external: false,
        })
        expect(result.isButtonUrlExternal).toBe(false)
    })

    test('falls back to false when is_button_url_external is undefined', () => {
        const result = mapBannerResponse({
            id: 5,
            type: 'generic',
            is_button_url_external: undefined as unknown as boolean,
        })
        expect(result.isButtonUrlExternal).toBe(false)
    })

    test('passes through force mode', () => {
        const result = mapBannerResponse({
            id: 4,
            type: 'generic',
            is_button_url_external: false,
            auto_open_mode: 'force',
        })
        expect(result.autoOpenMode).toBe('force')
    })
})

describe('hasRenderableContent', () => {
    test('true when any text-bearing field is set', () => {
        expect(
            hasRenderableContent({
                id: 1,
                type: 'generic',
                title: 'Hi',
                subtitle: null,
                buttonLabel: null,
                buttonUrl: null,
                isButtonUrlExternal: false,
                autoOpenMode: null,
                backgroundImageUrl: null,
            }),
        ).toBe(true)
    })

    test('false when all text fields are null', () => {
        expect(
            hasRenderableContent({
                id: 1,
                type: 'generic',
                title: null,
                subtitle: null,
                buttonLabel: null,
                buttonUrl: null,
                isButtonUrlExternal: false,
                autoOpenMode: null,
                backgroundImageUrl: null,
            }),
        ).toBe(false)
    })
})

describe('mapSpotBannerResponse', () => {
    test('maps full payload', () => {
        const result = mapSpotBannerResponse({
            id: 4,
            text: 'Hi',
            image: 'https://cdn.test/x.png',
            url: 'pera://x',
            button_url_is_external: true,
        })

        expect(result).toEqual({
            id: 4,
            text: 'Hi',
            imageUrl: 'https://cdn.test/x.png',
            url: 'pera://x',
            isUrlExternal: true,
        })
    })

    test('falls back to false when button_url_is_external is undefined', () => {
        const result = mapSpotBannerResponse({
            id: 5,
            text: 'Hi',
            image: 'https://cdn.test/x.png',
            url: 'pera://x',
            button_url_is_external: undefined as unknown as boolean,
        })
        expect(result.isUrlExternal).toBe(false)
    })
})
