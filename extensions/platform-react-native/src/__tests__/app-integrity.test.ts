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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const appIntegrityMock = vi.hoisted(() => ({
    isSupported: true,
    generateKeyAsync: vi.fn(),
    attestKeyAsync: vi.fn(),
    prepareIntegrityTokenProviderAsync: vi.fn(),
    requestIntegrityCheckAsync: vi.fn(),
}))
vi.mock('@expo/app-integrity', () => appIntegrityMock)
vi.mock('@perawallet/wallet-core-config', () => ({
    config: { playIntegrityCloudProjectNumber: 'cloud-project-1' },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

import { RNAppIntegrityService } from '../services/app-integrity'
import { Platform } from 'react-native'

describe('RNAppIntegrityService', () => {
    beforeEach(() => {
        appIntegrityMock.generateKeyAsync.mockReset().mockResolvedValue('key-1')
        appIntegrityMock.attestKeyAsync
            .mockReset()
            .mockResolvedValue('ios-attestation')
        appIntegrityMock.prepareIntegrityTokenProviderAsync
            .mockReset()
            .mockResolvedValue(undefined)
        appIntegrityMock.requestIntegrityCheckAsync
            .mockReset()
            .mockResolvedValue('android-token')
    })

    it('attests on iOS with a generated key id', async () => {
        vi.mocked(Platform).OS = 'ios'
        const result = await new RNAppIntegrityService().attest('challenge-1')
        expect(appIntegrityMock.attestKeyAsync).toHaveBeenCalledWith(
            'key-1',
            'challenge-1',
        )
        expect(result).toEqual({
            attestation: 'ios-attestation',
            keyId: 'key-1',
        })
    })

    it('attests on Android with base64(SHA256(utf8(challenge))) request hash', async () => {
        vi.mocked(Platform).OS = 'android'
        const result = await new RNAppIntegrityService().attest(
            'test-challenge-string',
        )
        expect(
            appIntegrityMock.prepareIntegrityTokenProviderAsync,
        ).toHaveBeenCalledWith('cloud-project-1')
        // Known-answer vector: base64(SHA256(utf8('test-challenge-string'))).
        expect(
            appIntegrityMock.requestIntegrityCheckAsync,
        ).toHaveBeenCalledWith('ctTUzn9DZUMxXIw8AunJ6kTMErxsrkmZfKibQ1TlhyU=')
        expect(result).toEqual({ attestation: 'android-token' })
        expect(result.keyId).toBeUndefined()
    })
})
