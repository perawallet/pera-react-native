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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { HTTPError } from 'ky'
import { fetchApplication } from '../endpoints'

const mockQueryClient = vi.fn()

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: (...args: unknown[]) => mockQueryClient(...args),
}))

describe('fetchApplication', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns transformed application on success', async () => {
        mockQueryClient.mockResolvedValue({
            data: {
                application_id: 123,
                name: 'Test App',
                project: {
                    name: 'Test Project',
                    url: 'https://test.com',
                    description: 'A test project',
                    short_description: 'Test',
                    logo_png: 'https://test.com/logo.png',
                    verification_tier: 'verified',
                    color: '#000',
                    text_color: '#FFF',
                    background_image: 'https://test.com/bg.png',
                    categories: [],
                    popularity_score: 10,
                },
            },
        })

        const result = await fetchApplication({
            applicationId: '123',
            network: 'mainnet',
        })

        expect(result).toEqual({
            applicationId: 123,
            name: 'Test App',
            project: {
                name: 'Test Project',
                url: 'https://test.com',
                description: 'A test project',
                shortDescription: 'Test',
                logoPng: 'https://test.com/logo.png',
                verificationTier: 'verified',
                color: '#000',
                textColor: '#FFF',
                backgroundImage: 'https://test.com/bg.png',
                categories: [],
                popularityScore: 10,
            },
        })
    })

    test('returns null on 404', async () => {
        const response = new Response(null, { status: 404 })
        const request = new Request('https://example.com')
        mockQueryClient.mockRejectedValue(new HTTPError(response, request, {}))

        const result = await fetchApplication({
            applicationId: '999',
            network: 'mainnet',
        })

        expect(result).toBeNull()
    })

    test('rethrows non-404 errors', async () => {
        const response = new Response(null, { status: 500 })
        const request = new Request('https://example.com')
        mockQueryClient.mockRejectedValue(new HTTPError(response, request, {}))

        await expect(
            fetchApplication({
                applicationId: '123',
                network: 'mainnet',
            }),
        ).rejects.toThrow(HTTPError)
    })
})
