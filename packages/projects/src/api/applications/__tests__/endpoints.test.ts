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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { fetchApplication } from '../endpoints'

const mockQueryClient = vi.fn()

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<object>()),
    queryClient: (...args: unknown[]) => mockQueryClient(...args),
    logger: { warn: vi.fn() },
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
            applicationId: '123',
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

    test('returns null when the application is not found (typed 404)', async () => {
        mockQueryClient.mockRejectedValueOnce(
            new PeraNetworkError('client', { status: 404 }),
        )

        const result = await fetchApplication({
            applicationId: '999',
            network: 'mainnet',
        })

        expect(result).toBeNull()
    })

    test('returns null on schema validation failure', async () => {
        mockQueryClient.mockResolvedValue({
            data: { unexpected: 'shape' },
        })

        const result = await fetchApplication({
            applicationId: '123',
            network: 'mainnet',
        })

        expect(result).toBeNull()
    })

    test('rethrows non-404 errors', async () => {
        mockQueryClient.mockRejectedValue(
            new PeraNetworkError('server', { status: 500 }),
        )

        await expect(
            fetchApplication({
                applicationId: '123',
                network: 'mainnet',
            }),
        ).rejects.toThrow(PeraNetworkError)
    })

    describe('non-Pera-backed networks', () => {
        test.each(['betanet', 'custom'] as const)(
            'returns null on %s without calling the client',
            async network => {
                const result = await fetchApplication({
                    applicationId: '123',
                    network,
                })

                expect(result).toBeNull()
                expect(mockQueryClient).not.toHaveBeenCalled()
            },
        )

        test('still calls through normally on testnet', async () => {
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
                network: 'testnet',
            })

            expect(result).not.toBeNull()
            expect(mockQueryClient).toHaveBeenCalledTimes(1)
        })
    })
})
