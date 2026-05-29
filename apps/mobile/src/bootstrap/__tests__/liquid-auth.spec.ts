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

import { bootstrapLiquidAuth } from '@perawallet/wallet-extension-liquid-auth'
import { logger } from '@perawallet/wallet-core-shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runLiquidAuthBootstrap } from '../liquid-auth'

import type { CredentialMechanism } from '@perawallet/wallet-extension-liquid-auth'

vi.mock('@perawallet/wallet-extension-liquid-auth', () => ({
    bootstrapLiquidAuth: vi.fn(),
}))

const mockBootstrapLiquidAuth = vi.mocked(bootstrapLiquidAuth)

const createMechanism = (): CredentialMechanism => ({
    get: vi.fn(),
    create: vi.fn(),
})

describe('runLiquidAuthBootstrap', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('bootstraps Liquid Auth with the provided credential mechanism', () => {
        const mechanism = createMechanism()

        runLiquidAuthBootstrap(mechanism)

        expect(mockBootstrapLiquidAuth).toHaveBeenCalledWith(mechanism)
    })

    it('logs an error when bootstrap throws', () => {
        const loggerSpy = vi
            .spyOn(logger, 'error')
            .mockImplementation(() => undefined)
        mockBootstrapLiquidAuth.mockImplementationOnce(() => {
            throw new Error('boom')
        })

        runLiquidAuthBootstrap(createMechanism())

        expect(loggerSpy).toHaveBeenCalled()
        loggerSpy.mockRestore()
    })
})
