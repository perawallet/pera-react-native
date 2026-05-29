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

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../vendor/signalClient', () => ({
    SignalClient: vi.fn(),
}))

import { WithLiquidAuth } from '../extension'
import { LiquidAuthServiceImpl } from '../service'

type GlobalWithNavigator = typeof globalThis & {
    navigator?: {
        credentials?: {
            get: (o: unknown) => Promise<unknown>
            create: (o: unknown) => Promise<unknown>
        }
    }
}

describe('WithLiquidAuth', () => {
    it('attaches a liquidAuth service to the provider that signs via the keystore', async () => {
        const sign = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
        const provider = {
            key: { store: { sign } },
        } as unknown as Record<string, unknown>

        const result = WithLiquidAuth(provider as never)

        expect((provider as { liquidAuth?: unknown }).liquidAuth).toBeDefined()
        expect(result.liquidAuth).toBe(
            (provider as { liquidAuth: unknown }).liquidAuth,
        )
    })

    describe('getSessionCookie', () => {
        const signChallenge = vi
            .fn()
            .mockResolvedValue(new Uint8Array([1, 2, 3]))
        const baseDeps = {
            signChallenge,
            getCredential: vi.fn(),
            createCredential: vi.fn(),
            hasCredentialForHost: vi.fn(),
        }

        it('returns the cookie from the injected getSessionCookie dep', async () => {
            const getSessionCookie = vi
                .fn()
                .mockResolvedValue('connect.sid=abc')
            const service = new LiquidAuthServiceImpl({
                ...baseDeps,
                getSessionCookie,
            })

            await expect(
                service.getSessionCookie('https://liquid.example.com'),
            ).resolves.toBe('connect.sid=abc')
            expect(getSessionCookie).toHaveBeenCalledWith(
                'https://liquid.example.com',
            )
        })

        it('resolves undefined when no getSessionCookie dep is provided', async () => {
            const service = new LiquidAuthServiceImpl(baseDeps)

            await expect(
                service.getSessionCookie('https://liquid.example.com'),
            ).resolves.toBeUndefined()
        })
    })

    describe('credential delegation to navigator.credentials polyfill', () => {
        const origin = 'https://liquid.example.com'
        const ceremonyInput = {
            origin,
            requestId: 'req-1',
            address:
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            keyId: 'key-1',
            deviceName: 'test-device',
        }

        afterEach(() => {
            // Restore navigator to avoid leaking state between tests.
            delete (globalThis as GlobalWithNavigator).navigator
        })

        it('delegates createCredential to navigator.credentials.create when polyfill is installed', async () => {
            const createSpy = vi.fn().mockResolvedValue({
                id: 'new',
                response: {},
                clientExtensionResults: {},
            })
            const getSpy = vi.fn()

            // navigator is a getter-only property in the vitest environment;
            // use defineProperty to override it for this test.
            Object.defineProperty(globalThis, 'navigator', {
                value: { credentials: { create: createSpy, get: getSpy } },
                configurable: true,
                writable: true,
            })

            const sign = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
            const provider = {
                key: { store: { sign } },
            } as unknown as Record<string, unknown>

            WithLiquidAuth(provider as never)
            const service = (
                provider as {
                    liquidAuth: {
                        runCeremony: (
                            i: typeof ceremonyInput,
                        ) => Promise<{ credentialId: string }>
                    }
                }
            ).liquidAuth

            // Two fetch calls: POST /attestation/request → options, POST /attestation/response → ok.
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 201,
                    json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({}),
                })
            vi.stubGlobal('fetch', fetchMock)

            const result = await service.runCeremony(ceremonyInput)

            expect(createSpy).toHaveBeenCalledOnce()
            expect(result.credentialId).toBe('new')

            vi.unstubAllGlobals()
        })

        it('throws a clear error when navigator.credentials is not installed', async () => {
            // Override navigator to have no credentials property.
            Object.defineProperty(globalThis, 'navigator', {
                value: {},
                configurable: true,
                writable: true,
            })

            const sign = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
            const provider = {
                key: { store: { sign } },
            } as unknown as Record<string, unknown>

            WithLiquidAuth(provider as never)
            const service = (
                provider as {
                    liquidAuth: {
                        runCeremony: (
                            i: typeof ceremonyInput,
                        ) => Promise<{ credentialId: string }>
                    }
                }
            ).liquidAuth

            // hasCredentialForHost returns null → attestation path → createCredential called.
            // But first fetch resolves so we get to the createCredential call.
            const fetchMock = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
            })
            vi.stubGlobal('fetch', fetchMock)

            await expect(service.runCeremony(ceremonyInput)).rejects.toThrow(
                'navigator.credentials unavailable',
            )

            vi.unstubAllGlobals()
        })
    })
})
