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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { useFindQuantumAccountForMnemonic } from '../useFindQuantumAccountForMnemonic'
import { SingleKeyAccountsUnsupportedError } from '../../errors'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
    registerFakeAccountsChain,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

const INDICES = new Uint16Array(25)

const findOp = () =>
    vi.mocked(
        fakeAccountsChain().adapter.singleKeyAccounts!
            .findQuantumAccountForAlgo25Mnemonic,
    )

describe('useFindQuantumAccountForMnemonic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeAccountsChain()
    })

    test('returns the quantum address the chain finds for the active network', async () => {
        findOp().mockResolvedValue('QUANTUM')

        const { result } = renderHook(() => useFindQuantumAccountForMnemonic())

        await expect(result.current(INDICES)).resolves.toBe('QUANTUM')
        expect(findOp()).toHaveBeenCalledWith(INDICES, MAINNET_SCOPE)
    })

    test('probes the network the wallet is on', async () => {
        vi.mocked(useNetwork).mockReturnValue({ network: 'testnet' } as never)
        findOp().mockResolvedValue(null)

        const { result } = renderHook(() => useFindQuantumAccountForMnemonic())

        await expect(result.current(INDICES)).resolves.toBeNull()
        expect(findOp()).toHaveBeenCalledWith(INDICES, TESTNET_SCOPE)
    })

    test('fails closed on a chain without single-key accounts', async () => {
        registerFakeAccountsChain({ singleKeyAccounts: undefined })

        const { result } = renderHook(() => useFindQuantumAccountForMnemonic())

        await expect(result.current(INDICES)).rejects.toBeInstanceOf(
            SingleKeyAccountsUnsupportedError,
        )
    })
})
