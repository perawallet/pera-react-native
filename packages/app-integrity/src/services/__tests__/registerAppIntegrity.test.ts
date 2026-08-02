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

const attestDeviceMock = vi.fn()
const requestChallengeMock = vi.fn()
vi.mock('../../api/integrity', () => ({
    requestChallenge: (...a: unknown[]) => requestChallengeMock(...a),
    attestDevice: (...a: unknown[]) => attestDeviceMock(...a),
}))

const providerMock = {
    deviceInfo: {
        getDeviceID: vi.fn().mockResolvedValue('device-1'),
        getDevicePlatform: vi.fn().mockReturnValue('android'),
        getAppEnvironment: vi.fn().mockReturnValue('production'),
        isStoreBuild: vi.fn().mockReturnValue(true),
    },
    appIntegrity: {
        isSupported: vi.fn().mockResolvedValue(true),
        attest: vi.fn(),
    },
    // Importing the real store triggers zustand persist hydration via
    // getProvider().keyValueStorage, so this stub must exist.
    keyValueStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => providerMock,
}))

// Only the logger is stubbed — isConnectivityError stays real so the offline
// classification under test is the one that ships.
const loggerMocks = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { warn: loggerMocks.warn, error: loggerMocks.error },
}))

import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { registerAppIntegrity } from '../registerAppIntegrity'
import { useAppIntegrityStore } from '../../store'

describe('registerAppIntegrity', () => {
    beforeEach(() => {
        loggerMocks.warn.mockReset()
        loggerMocks.error.mockReset()
        useAppIntegrityStore.getState().resetState()
        requestChallengeMock.mockReset().mockResolvedValue('challenge-1')
        attestDeviceMock.mockReset().mockResolvedValue({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01',
        })
        providerMock.deviceInfo.getDevicePlatform.mockReturnValue('android')
        providerMock.deviceInfo.getAppEnvironment.mockReturnValue('production')
        providerMock.appIntegrity.isSupported.mockResolvedValue(true)
        providerMock.appIntegrity.attest
            .mockReset()
            .mockResolvedValue({ attestation: 'play-token' })
    })

    it('runs the android handshake and stores the token', async () => {
        const result = await registerAppIntegrity({ network: 'mainnet' })
        expect(result.status).toBe('success')
        expect(providerMock.appIntegrity.attest).toHaveBeenCalledWith(
            'challenge-1',
        )
        expect(attestDeviceMock).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    platform: 'android',
                    attestation: 'play-token',
                }),
            }),
        )
        expect(useAppIntegrityStore.getState().integrityToken).toBe('jwt')
    })

    it('runs the iOS handshake with the attested key and attestation', async () => {
        providerMock.deviceInfo.getDevicePlatform.mockReturnValue('ios')
        providerMock.appIntegrity.attest.mockResolvedValue({
            attestation: 'attestation-1',
            keyId: 'key-1',
        })
        const result = await registerAppIntegrity({ network: 'mainnet' })
        expect(result.status).toBe('success')
        expect(attestDeviceMock).toHaveBeenCalledWith(
            expect.objectContaining({
                payload: expect.objectContaining({
                    platform: 'ios',
                    keyId: 'key-1',
                    attestation: 'attestation-1',
                }),
            }),
        )
        expect(useAppIntegrityStore.getState().keyId).toBe('key-1')
    })

    it('skips on development builds without attesting', async () => {
        providerMock.deviceInfo.getAppEnvironment.mockReturnValue('development')
        const result = await registerAppIntegrity({ network: 'mainnet' })
        expect(result.status).toBe('skipped')
        expect(requestChallengeMock).not.toHaveBeenCalled()
        expect(attestDeviceMock).not.toHaveBeenCalled()
        expect(useAppIntegrityStore.getState().status).toBe('skipped')
    })

    it('attests on staging builds (production flow)', async () => {
        providerMock.deviceInfo.getAppEnvironment.mockReturnValue('staging')
        const result = await registerAppIntegrity({ network: 'mainnet' })
        expect(result.status).toBe('success')
        expect(attestDeviceMock).toHaveBeenCalled()
    })

    it('skips when attestation is unsupported', async () => {
        providerMock.deviceInfo.getDevicePlatform.mockReturnValue('ios')
        providerMock.appIntegrity.isSupported.mockResolvedValueOnce(false)
        const result = await registerAppIntegrity({ network: 'mainnet' })
        expect(result.status).toBe('skipped')
        expect(attestDeviceMock).not.toHaveBeenCalled()
        expect(useAppIntegrityStore.getState().status).toBe('skipped')
    })

    it('records errors without throwing', async () => {
        requestChallengeMock.mockRejectedValueOnce(new Error('network down'))
        const result = await registerAppIntegrity({ network: 'mainnet' })
        expect(result.status).toBe('error')
        expect(useAppIntegrityStore.getState().status).toBe('error')
        expect(useAppIntegrityStore.getState().lastError).toContain(
            'network down',
        )
    })

    // Reporting the error object rather than a fixed message is what lets the
    // crash reporter separate a native attestation failure from a backend
    // rejection instead of merging every cause into one issue.
    it('reports the underlying error so causes stay distinguishable', async () => {
        const cause = new Error('play integrity unavailable')
        providerMock.appIntegrity.attest.mockRejectedValueOnce(cause)

        await registerAppIntegrity({ network: 'mainnet' })

        expect(loggerMocks.error).toHaveBeenCalledWith(cause, {
            step: 'registerAppIntegrity',
        })
        expect(loggerMocks.warn).not.toHaveBeenCalled()
    })

    it('keeps an offline boot off the crash reporter', async () => {
        requestChallengeMock.mockRejectedValueOnce(
            new PeraNetworkError('offline'),
        )

        const result = await registerAppIntegrity({ network: 'mainnet' })

        expect(result.status).toBe('error')
        expect(loggerMocks.error).not.toHaveBeenCalled()
        expect(loggerMocks.warn).toHaveBeenCalled()
    })
})
