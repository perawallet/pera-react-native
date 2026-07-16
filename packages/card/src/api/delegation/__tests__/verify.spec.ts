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

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockConfig } = vi.hoisted(() => ({
    mockConfig: { appEnvironment: 'development' as string },
}))

vi.mock('@perawallet/wallet-core-config', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-config')),
    config: mockConfig,
}))

import {
    verifyDelegationProgram,
    DelegationProgramUnverifiedError,
} from '../verify'

describe('verifyDelegationProgram', () => {
    // Matches the base64 'BIEB' dev-mock program.
    const program = new Uint8Array([4, 129, 1])

    beforeEach(() => {
        mockConfig.appEnvironment = 'development'
    })

    it('allows any program outside production (the dev mock stands in)', () => {
        expect(() => verifyDelegationProgram(program, 'mainnet')).not.toThrow()
    })

    it('refuses an unpinned program in production', () => {
        mockConfig.appEnvironment = 'production'
        expect(() => verifyDelegationProgram(program, 'mainnet')).toThrow(
            DelegationProgramUnverifiedError,
        )
    })

    it('refuses on testnet in production too', () => {
        mockConfig.appEnvironment = 'production'
        expect(() => verifyDelegationProgram(program, 'testnet')).toThrow(
            DelegationProgramUnverifiedError,
        )
    })
})
