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

// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockMode = vi.hoisted(() => ({ current: 'live' }))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => mockMode.current,
}))

const registerMock = vi.fn()
vi.mock('../../services/registerAppIntegrity', () => ({
    registerAppIntegrity: (...a: unknown[]) => registerMock(...a),
}))

import { useAppIntegrityBootstrap } from '../useAppIntegrityBootstrap'
import { useAppIntegrityStore } from '../../store'

describe('useAppIntegrityBootstrap', () => {
    beforeEach(() => {
        registerMock.mockReset().mockResolvedValue({ status: 'success' })
        useAppIntegrityStore.getState().resetState()
        mockMode.current = 'live'
    })

    it.each(['live', 'developer'])(
        'registers on boot against the %s deployment when there is no valid token',
        deployment => {
            mockMode.current = deployment
            renderHook(() => useAppIntegrityBootstrap())
            expect(registerMock).toHaveBeenCalledOnce()
            expect(registerMock).toHaveBeenCalledWith({ deployment })
        },
    )

    it('does not re-register when an unexpired token exists', () => {
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'jwt',
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            keyId: null,
            deviceInstallationId: 'd1',
        })
        renderHook(() => useAppIntegrityBootstrap())
        expect(registerMock).not.toHaveBeenCalled()
    })
})
