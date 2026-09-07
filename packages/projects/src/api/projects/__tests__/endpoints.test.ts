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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { fetchProjectByUrl } from '../endpoints'

const mockQueryClient = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: (...args: unknown[]) => mockQueryClient(...args),
}))

describe('fetchProjectByUrl', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns transformed project list on success', async () => {
        mockQueryClient.mockResolvedValue({
            data: [
                {
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
            ],
        })

        const result = await fetchProjectByUrl({
            sourceUrl: 'https://test.com',
            network: 'mainnet',
        })

        expect(result).toEqual([
            {
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
        ])
    })

    describe('non-Pera-backed networks', () => {
        test.each(['betanet', 'custom'] as const)(
            'returns [] on %s without calling the client',
            async network => {
                const result = await fetchProjectByUrl({
                    sourceUrl: 'https://test.com',
                    network,
                })

                expect(result).toEqual([])
                expect(mockQueryClient).not.toHaveBeenCalled()
            },
        )

        test('still calls through normally on testnet', async () => {
            mockQueryClient.mockResolvedValue({
                data: [
                    {
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
                ],
            })

            const result = await fetchProjectByUrl({
                sourceUrl: 'https://test.com',
                network: 'testnet',
            })

            expect(result).toHaveLength(1)
            expect(mockQueryClient).toHaveBeenCalledTimes(1)
        })
    })
})
