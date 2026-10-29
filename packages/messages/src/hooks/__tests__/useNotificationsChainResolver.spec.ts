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
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { isSentInDeviceRegistration } from '@perawallet/wallet-core-device'
import { useNotificationsChainResolver } from '../useNotificationsChainResolver'

const state = vi.hoisted(() => ({
    chainIds: ['algorand', 'ethereum'] as string[],
    deployment: 'live' as WalletMode,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useRegisteredChainIds: () => state.chainIds,
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useWalletDeployment: () => state.deployment,
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-device')
    >()),
    isSentInDeviceRegistration: vi.fn(),
}))

const ethereumAccount: WalletAccount = {
    id: 'acc-eth',
    chains: {
        ethereum: { address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed' },
    },
    custody: { kind: 'watch' },
}

describe('useNotificationsChainResolver', () => {
    beforeEach(() => {
        vi.mocked(isSentInDeviceRegistration).mockReset()
        state.deployment = 'live'
    })

    it("resolves to the account's own chain when registration sends its address there", () => {
        vi.mocked(isSentInDeviceRegistration).mockReturnValue(true)
        state.deployment = 'developer'

        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(ethereumAccount)).toBe('ethereum')
        expect(isSentInDeviceRegistration).toHaveBeenCalledWith(
            ethereumAccount,
            'ethereum',
            'developer',
        )
    })

    it('resolves to nothing when registration leaves the address out', () => {
        vi.mocked(isSentInDeviceRegistration).mockReturnValue(false)

        const { result } = renderHook(() => useNotificationsChainResolver())

        expect(result.current(ethereumAccount)).toBeUndefined()
    })

    it('keeps its identity across renders', () => {
        const { result, rerender } = renderHook(() =>
            useNotificationsChainResolver(),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })

    it('changes identity when the wallet switches deployment', () => {
        const { result, rerender } = renderHook(() =>
            useNotificationsChainResolver(),
        )
        const first = result.current

        state.deployment = 'developer'
        rerender()

        expect(result.current).not.toBe(first)
    })
})
