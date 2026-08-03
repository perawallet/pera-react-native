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
import { renderHook, act, waitFor } from '@testing-library/react'

const registerMock = vi.fn()
const verifyMock = vi.fn()
vi.mock('@perawallet/wallet-core-app-integrity', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-app-integrity')
    >('@perawallet/wallet-core-app-integrity')
    return {
        ...actual,
        useAppIntegrityRegistration: () => ({
            register: registerMock,
            isRegistering: false,
        }),
        verifyIntegrityToken: (...a: unknown[]) => verifyMock(...a),
    }
})
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: {
            getAppEnvironment: () => 'development',
            getDevicePlatform: () => 'web',
        },
        appIntegrity: {
            isSupported: async () => false,
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

import { useSettingsDeveloperAppIntegrity } from '../useSettingsDeveloperAppIntegrity'
import { useAppIntegrityStore } from '@perawallet/wallet-core-app-integrity'

describe('useSettingsDeveloperAppIntegrity', () => {
    beforeEach(() => {
        registerMock.mockReset().mockResolvedValue({ status: 'success' })
        verifyMock
            .mockReset()
            .mockResolvedValue({
                ok: true,
                deviceInstallationId: 'd1',
                platform: 'ios',
            })
        useAppIntegrityStore.getState().resetState()
    })

    it('runs the handshake', async () => {
        const { result } = renderHook(() => useSettingsDeveloperAppIntegrity())
        await act(async () => {
            await result.current.onRunHandshake()
        })
        expect(registerMock).toHaveBeenCalled()
    })

    it('verifies the stored token and exposes the result', async () => {
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'jwt',
            expiresAt: '2026-07-01',
            keyId: null,
            deviceInstallationId: 'd1',
        })
        const { result } = renderHook(() => useSettingsDeveloperAppIntegrity())
        await act(async () => {
            await result.current.onVerifyToken()
        })
        expect(verifyMock).toHaveBeenCalledWith({
            integrityToken: 'jwt',
            network: 'mainnet',
        })
        await waitFor(() => expect(result.current.verifyResult?.ok).toBe(true))
    })

    it('clears stored state', () => {
        useAppIntegrityStore.getState().setError('boom')
        const { result } = renderHook(() => useSettingsDeveloperAppIntegrity())
        act(() => result.current.onClear())
        expect(useAppIntegrityStore.getState().status).toBe('idle')
    })
})
