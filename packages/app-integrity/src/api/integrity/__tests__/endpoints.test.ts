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

import { describe, expect, it, vi, beforeEach } from 'vitest'

const queryClientMock = vi.fn()
vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: (...args: unknown[]) => queryClientMock(...args),
}))

import {
    requestChallenge,
    attestDevice,
    verifyIntegrityToken,
} from '../endpoints'

describe('integrity endpoints', () => {
    beforeEach(() => queryClientMock.mockReset())

    it('requests a challenge with device id and platform', async () => {
        queryClientMock.mockResolvedValue({ data: { challenge: 'abc' } })
        const challenge = await requestChallenge({
            deviceInstallationId: 'd1',
            platform: 'ios',
            network: 'mainnet',
        })
        expect(challenge).toBe('abc')
        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                method: 'POST',
                url: '/api/v3/public/integrity/challenge',
                data: { device_id: 'd1', platform: 'ios' },
            }),
        )
    })

    it('attests an iOS device with key id', async () => {
        queryClientMock.mockResolvedValue({
            data: { integrity_token: 'jwt', expires_at: '2026-07-01' },
        })
        const result = await attestDevice({
            payload: {
                deviceInstallationId: 'd1',
                platform: 'ios',
                keyId: 'k1',
                attestation: 'att',
            },
            network: 'mainnet',
        })
        expect(result).toEqual({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01',
        })
        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/api/v3/public/integrity/attest',
                data: {
                    device_id: 'd1',
                    platform: 'ios',
                    key_id: 'k1',
                    attestation: 'att',
                },
            }),
        )
    })

    it('omits key_id for Android attestation', async () => {
        queryClientMock.mockResolvedValue({
            data: { integrity_token: 'jwt', expires_at: '2026-07-01' },
        })
        await attestDevice({
            payload: {
                deviceInstallationId: 'd1',
                platform: 'android',
                attestation: 'tok',
            },
            network: 'mainnet',
        })
        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: {
                    device_id: 'd1',
                    platform: 'android',
                    attestation: 'tok',
                },
            }),
        )
    })

    it('verifies a token via the integrity header', async () => {
        queryClientMock.mockResolvedValue({
            data: { ok: true, device_id: 'd1', platform: 'ios' },
        })
        const result = await verifyIntegrityToken({
            integrityToken: 'jwt',
            network: 'mainnet',
        })
        expect(result).toEqual({
            ok: true,
            deviceInstallationId: 'd1',
            platform: 'ios',
        })
        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/api/v3/test-integrity',
                headers: { 'x-app-integrity-token': 'jwt' },
            }),
        )
    })
})
