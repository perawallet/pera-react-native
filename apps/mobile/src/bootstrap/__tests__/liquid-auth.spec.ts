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

import {
    bootstrapLiquidAuth,
    setLiquidAuthKeystoreHost,
} from '@perawallet/wallet-extension-liquid-auth'
import { logger } from '@perawallet/wallet-core-shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runLiquidAuthBootstrap } from '../liquid-auth'

import type { CredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

vi.mock('@perawallet/wallet-extension-liquid-auth', () => ({
    bootstrapLiquidAuth: vi.fn(),
    setLiquidAuthKeystoreHost: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ key: { store: {} }, biometrics: {} }),
    getKeystoreStore: () => ({ state: { keys: [] } }),
}))

const mockBootstrapLiquidAuth = vi.mocked(bootstrapLiquidAuth)
const mockSetHost = vi.mocked(setLiquidAuthKeystoreHost)

const createMechanism = (): CredentialMechanism => ({
    get: vi.fn(),
    create: vi.fn(),
})

describe('runLiquidAuthBootstrap', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('wires the keystore host then bootstraps with the credential mechanism', async () => {
        const mechanism = createMechanism()

        await runLiquidAuthBootstrap(mechanism)

        expect(mockSetHost).toHaveBeenCalledTimes(1)
        expect(mockBootstrapLiquidAuth).toHaveBeenCalledWith(mechanism)
    })

    it('logs an error when bootstrap throws', async () => {
        const loggerSpy = vi
            .spyOn(logger, 'error')
            .mockImplementation(() => undefined)
        mockBootstrapLiquidAuth.mockRejectedValueOnce(new Error('boom'))

        await runLiquidAuthBootstrap(createMechanism())

        expect(loggerSpy).toHaveBeenCalled()
        loggerSpy.mockRestore()
    })
})
