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
import { transformApplication } from '../transformers'
import type { ApplicationApiResponse } from '../schema'

describe('transformApplication', () => {
    test('transforms a full application response to domain model', () => {
        const response: ApplicationApiResponse = {
            application_id: 123456,
            name: 'Tinyman AMM',
            project: {
                name: 'Tinyman',
                verification_tier: 'verified',
                logo_png: 'https://tinyman.org/logo.png',
            },
        }

        const result = transformApplication(response)

        expect(result.applicationId).toBe(123456)
        expect(result.name).toBe('Tinyman AMM')
        expect(result.project.name).toBe('Tinyman')
        expect(result.project.logoPng).toBe('https://tinyman.org/logo.png')
        expect(result.project.verificationTier).toBe('verified')
    })

    test('handles a response with optional fields absent', () => {
        const response: ApplicationApiResponse = {
            project: {},
        }

        const result = transformApplication(response)

        expect(result.applicationId).toBeUndefined()
        expect(result.name).toBeUndefined()
        expect(result.project.name).toBeUndefined()
        expect(result.project.verificationTier).toBeUndefined()
    })
})
