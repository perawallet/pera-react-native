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
import { renderHook, waitFor } from '@testing-library/react'

const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const

const registerMock = vi.fn()
vi.mock('../../services/registerAppIntegrity', () => ({
    registerAppIntegrity: (...a: unknown[]) => registerMock(...a),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        // Importing the real store triggers zustand persist hydration via
        // getProvider().keyValueStorage, so this stub must exist.
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

import { useAppIntegrityBootstrap } from '../useAppIntegrityBootstrap'
import { useAppIntegrityStore } from '../../store'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

describe('useAppIntegrityBootstrap', () => {
    beforeEach(() => {
        registerMock.mockReset().mockResolvedValue({ status: 'success' })
        useAppIntegrityStore.getState().resetState()
    })

    it.each([ALGORAND_MAINNET, ETHEREUM_SEPOLIA])(
        'registers on boot with the given scope when there is no valid token ($chainId)',
        async scope => {
            renderHook(() => useAppIntegrityBootstrap(scope))
            await waitFor(() => expect(registerMock).toHaveBeenCalledOnce())
            expect(registerMock).toHaveBeenCalledWith({ scope })
        },
    )

    it('does not re-register when an unexpired token exists', async () => {
        useAppIntegrityStore.getState().setRegistration({
            integrityToken: 'jwt',
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            keyId: null,
            deviceInstallationId: 'd1',
        })
        renderHook(() => useAppIntegrityBootstrap(ALGORAND_MAINNET))
        await new Promise(r => setTimeout(r, 10))
        expect(registerMock).not.toHaveBeenCalled()
    })
})
