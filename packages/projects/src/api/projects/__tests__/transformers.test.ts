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
import { transformProject, transformProjectList } from '../transformers'
import type { ProjectApiResponse } from '../schema'

describe('transformProject', () => {
    test('transforms a full project response to domain model', () => {
        const response: ProjectApiResponse = {
            name: 'Tinyman',
            url: 'https://tinyman.org',
            description: 'A decentralized exchange',
            short_description: 'DEX on Algorand',
            logo_png: 'https://tinyman.org/logo.png',
            verification_tier: 'verified',
            color: '#00FF00',
            text_color: '#FFFFFF',
            background_image: 'https://tinyman.org/bg.png',
            categories: [{ id: 'defi', title: 'DeFi', order: 1 }],
            popularity_score: 95,
        }

        const result = transformProject(response)

        expect(result).toEqual({
            name: 'Tinyman',
            url: 'https://tinyman.org',
            description: 'A decentralized exchange',
            shortDescription: 'DEX on Algorand',
            logoPng: 'https://tinyman.org/logo.png',
            verificationTier: 'verified',
            color: '#00FF00',
            textColor: '#FFFFFF',
            backgroundImage: 'https://tinyman.org/bg.png',
            categories: [{ id: 'defi', title: 'DeFi', order: 1 }],
            popularityScore: 95,
        })
    })

    test('handles a minimal response with all optional fields absent', () => {
        const response: ProjectApiResponse = {}

        const result = transformProject(response)

        expect(result.name).toBeUndefined()
        expect(result.url).toBeUndefined()
        expect(result.description).toBeUndefined()
        expect(result.shortDescription).toBeUndefined()
        expect(result.logoPng).toBeUndefined()
        expect(result.verificationTier).toBeUndefined()
        expect(result.color).toBeUndefined()
        expect(result.textColor).toBeUndefined()
        expect(result.backgroundImage).toBeUndefined()
        expect(result.popularityScore).toBeUndefined()
    })
})

describe('transformProjectList', () => {
    test('transforms an array of project responses', () => {
        const responses: ProjectApiResponse[] = [
            { name: 'Tinyman', verification_tier: 'verified' },
            { name: 'Suspicious App', verification_tier: 'suspicious' },
        ]

        const result = transformProjectList(responses)

        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('Tinyman')
        expect(result[0].verificationTier).toBe('verified')
        expect(result[1].name).toBe('Suspicious App')
        expect(result[1].verificationTier).toBe('suspicious')
    })

    test('returns an empty array for empty input', () => {
        expect(transformProjectList([])).toEqual([])
    })
})
