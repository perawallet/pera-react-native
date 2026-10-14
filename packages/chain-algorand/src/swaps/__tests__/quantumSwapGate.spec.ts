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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAlgorandQuantumSwapEnabled } from '../quantumSwapGate'

const mocks = vi.hoisted(() => ({
    capabilities: { quantumAccounts: true, swap: true },
    remoteValue: undefined as boolean | undefined,
    getBooleanValue: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: { capabilities: () => mocks.capabilities },
        remoteConfig: {},
    }),
}))
vi.mock('@perawallet/wallet-core-remote-config', () => ({
    useRemoteConfigStore: { getState: () => ({ configOverrides: {} }) },
    readRemoteConfigWithOverrides: () => ({
        getBooleanValue: mocks.getBooleanValue,
    }),
}))
vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    isDebug: false,
    isStaging: false,
}))

describe('isAlgorandQuantumSwapEnabled', () => {
    beforeEach(() => {
        mocks.capabilities = { quantumAccounts: true, swap: true }
        mocks.getBooleanValue.mockReset()
        mocks.getBooleanValue.mockImplementation(
            (_key: string, fallback: boolean) => mocks.remoteValue ?? fallback,
        )
        mocks.remoteValue = true
    })

    it('is on when quantum accounts, swap and the remote flag are all on', () => {
        expect(isAlgorandQuantumSwapEnabled()).toBe(true)
        expect(mocks.getBooleanValue).toHaveBeenCalledWith(
            'enable_quantum_swap',
            false,
        )
    })

    it('is off when quantum accounts are switched off', () => {
        mocks.capabilities = { quantumAccounts: false, swap: true }

        expect(isAlgorandQuantumSwapEnabled()).toBe(false)
    })

    it('is off when swap is switched off', () => {
        mocks.capabilities = { quantumAccounts: true, swap: false }

        expect(isAlgorandQuantumSwapEnabled()).toBe(false)
    })

    it('is off when the remote flag is off', () => {
        mocks.remoteValue = false

        expect(isAlgorandQuantumSwapEnabled()).toBe(false)
    })

    it('falls back to off in a production release build', () => {
        mocks.remoteValue = undefined

        expect(isAlgorandQuantumSwapEnabled()).toBe(false)
    })
})
