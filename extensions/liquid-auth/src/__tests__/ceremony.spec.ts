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

import { describe, it, expect, vi } from 'vitest'
import { runFidoCeremony } from '../ceremony'

const toBytes = (s: string) => new TextEncoder().encode(s)

describe('runFidoCeremony (assertion path)', () => {
    it('signs the server challenge with the account key and posts the liquid extension', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ challenge: 'Y2hhbGxlbmdl' }), // "challenge" b64url
            })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

        const signer = vi.fn().mockResolvedValue(toBytes('signed'))
        const getCredential = vi.fn().mockResolvedValue({
            id: 'cred-1',
            response: {},
            clientExtensionResults: {},
        })

        const result = await runFidoCeremony(
            {
                origin: 'https://debug.liquidauth.com',
                requestId: 'req-1',
                address: 'ALGOADDR',
                keyId: 'key-1',
                deviceName: 'Pera',
            },
            {
                fetch: fetchMock as unknown as typeof fetch,
                signChallenge: signer,
                getCredential,
                createCredential: vi.fn(),
                hasCredentialForHost: async () => 'cred-1',
            },
        )

        expect(result.credentialId).toBe('cred-1')
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://debug.liquidauth.com/assertion/request/cred-1',
        )
        expect(signer).toHaveBeenCalledWith('key-1', toBytes('challenge'))
        const responseCall = fetchMock.mock.calls[1]
        const body = JSON.parse((responseCall[1] as RequestInit).body as string)
        expect(body.clientExtensionResults.liquid).toMatchObject({
            type: 'algorand',
            address: 'ALGOADDR',
            requestId: 'req-1',
            origin: 'https://debug.liquidauth.com',
        })
    })
})

describe('runFidoCeremony (input.credentialId)', () => {
    it('asserts the caller-supplied credentialId without consulting hasCredentialForHost', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
            })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

        const getCredential = vi.fn().mockResolvedValue({
            id: 'reused-cred',
            response: {},
            clientExtensionResults: {},
        })
        const createCredential = vi.fn()
        // Stub returns null — if it were consulted we'd attest instead of assert.
        const hasCredentialForHost = vi.fn().mockResolvedValue(null)

        const result = await runFidoCeremony(
            {
                origin: 'https://debug.liquidauth.com',
                requestId: 'req-reuse',
                address: 'ALGOADDR',
                keyId: 'key-1',
                deviceName: 'Pera',
                credentialId: 'reused-cred',
            },
            {
                fetch: fetchMock as unknown as typeof fetch,
                signChallenge: vi.fn().mockResolvedValue(toBytes('sig')),
                getCredential,
                createCredential,
                hasCredentialForHost,
            },
        )

        expect(result.credentialId).toBe('reused-cred')
        expect(getCredential).toHaveBeenCalled()
        expect(createCredential).not.toHaveBeenCalled()
        expect(hasCredentialForHost).not.toHaveBeenCalled()
        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://debug.liquidauth.com/assertion/request/reused-cred',
        )
    })
})

describe('runFidoCeremony (assertion failure fallback)', () => {
    it('re-attests when assertion fails (stale credential / deleted passkey)', async () => {
        // /assertion/request 404s (server no longer knows the credential),
        // then /attestation/request + /attestation/response succeed.
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => 'User not found.',
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
            })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

        const createCredential = vi.fn().mockResolvedValue({
            id: 'fresh-cred',
            response: {},
            clientExtensionResults: {},
        })

        const result = await runFidoCeremony(
            {
                origin: 'https://debug.liquidauth.com',
                requestId: 'req-reattest',
                address: 'ALGOADDR',
                keyId: 'key-1',
                deviceName: 'Pera',
                credentialId: 'stale-cred',
            },
            {
                fetch: fetchMock as unknown as typeof fetch,
                signChallenge: vi.fn().mockResolvedValue(toBytes('sig')),
                getCredential: vi.fn(),
                createCredential,
                hasCredentialForHost: async () => null,
            },
        )

        expect(result.credentialId).toBe('fresh-cred')
        expect(createCredential).toHaveBeenCalled()
        // First call was the failed assertion request for the stale id.
        expect(fetchMock.mock.calls[0][0]).toContain(
            '/assertion/request/stale-cred',
        )
        // Then it fell back to attestation.
        expect(fetchMock.mock.calls[1][0]).toBe(
            'https://debug.liquidauth.com/attestation/request',
        )
    })

    it('rethrows user cancellation instead of re-attesting a fresh credential', async () => {
        // The assertion challenge is fetched, then the user declines the UV
        // gate. This must surface the cancellation, NOT silently prompt again
        // and register a brand-new credential.
        const fetchMock = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
        })
        const createCredential = vi.fn()
        const cancel = new Error(
            'keystoreCredentials: user verification failed',
        )

        await expect(
            runFidoCeremony(
                {
                    origin: 'https://debug.liquidauth.com',
                    requestId: 'req-cancel',
                    address: 'ALGOADDR',
                    keyId: 'key-1',
                    deviceName: 'Pera',
                    credentialId: 'existing-cred',
                },
                {
                    fetch: fetchMock as unknown as typeof fetch,
                    signChallenge: vi.fn().mockResolvedValue(toBytes('sig')),
                    getCredential: vi.fn().mockRejectedValue(cancel),
                    createCredential,
                    hasCredentialForHost: async () => null,
                },
            ),
        ).rejects.toThrow(/user verification failed/)

        expect(createCredential).not.toHaveBeenCalled()
    })
})

describe('runFidoCeremony (attestation path)', () => {
    it('creates a credential with the liquid extension when none exists', async () => {
        const toBytesLocal = (s: string) => new TextEncoder().encode(s)
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
            })
            .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

        const createCredential = vi.fn().mockResolvedValue({
            id: 'new-cred',
            response: {},
            clientExtensionResults: {},
        })

        const result = await runFidoCeremony(
            {
                origin: 'https://debug.liquidauth.com',
                requestId: 'req-2',
                address: 'ALGOADDR',
                keyId: 'key-1',
                deviceName: 'Pera',
            },
            {
                fetch: fetchMock as unknown as typeof fetch,
                signChallenge: vi.fn().mockResolvedValue(toBytesLocal('sig')),
                getCredential: vi.fn(),
                createCredential,
                hasCredentialForHost: async () => null,
            },
        )

        expect(result.credentialId).toBe('new-cred')
        expect(createCredential).toHaveBeenCalled()
    })
})

describe('runFidoCeremony (server rejection)', () => {
    it('throws with the status + body when a ceremony POST is not ok', async () => {
        // /attestation/request succeeds, /attestation/response returns 401 —
        // the ceremony must surface that immediately, not proceed silently.
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({ challenge: 'Y2hhbGxlbmdl' }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'No session',
            })

        await expect(
            runFidoCeremony(
                {
                    origin: 'https://debug.liquidauth.com',
                    requestId: 'req-3',
                    address: 'ALGOADDR',
                    keyId: 'key-1',
                    deviceName: 'Pera',
                },
                {
                    fetch: fetchMock as unknown as typeof fetch,
                    signChallenge: vi.fn().mockResolvedValue(toBytes('sig')),
                    getCredential: vi.fn(),
                    createCredential: vi.fn().mockResolvedValue({
                        id: 'new-cred',
                        response: {},
                        clientExtensionResults: {},
                    }),
                    hasCredentialForHost: async () => null,
                },
            ),
        ).rejects.toThrow(/401.*No session/)
    })
})
