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
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../../models'
import { useAccountsStore } from '../../store'
import { testAccount } from '../../__tests__/accountFactory'
import { useAccountValueBasis } from '../useAccountValueBasis'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

const ALL_ON = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const register = (...ids: ChainId[]) => {
    for (const id of ids) {
        getProvider().chains.register(
            { id, networks: [] } as unknown as ChainDescriptor,
            ALL_ON,
        )
    }
}

const algorandAccount = testAccount('local', 'ALGO-ADDR')
const ethereumAccount: WalletAccount = {
    id: 'eth',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: '0xabc' } },
}

const basisWith = (accounts: WalletAccount[]) => {
    useAccountsStore.setState({ accounts })
    return renderHook(() => useAccountValueBasis('algorand')).result.current
}

describe('useAccountValueBasis', () => {
    it('stays native with only Algorand registered', () => {
        register('algorand')

        expect(basisWith([algorandAccount, ethereumAccount])).toBe('native')
    })

    it('stays native with a second chain registered but only Algorand accounts', () => {
        register('algorand', 'ethereum')

        expect(basisWith([algorandAccount])).toBe('native')
    })

    it('switches to fiat once any wallet account is on the second chain', () => {
        register('algorand', 'ethereum')

        expect(basisWith([algorandAccount, ethereumAccount])).toBe('fiat')
    })

    it('switches to fiat for an account derived on both chains', () => {
        register('algorand', 'ethereum')

        expect(
            basisWith([
                {
                    ...algorandAccount,
                    chains: {
                        ...algorandAccount.chains,
                        ethereum: { address: '0xboth' },
                    },
                },
            ]),
        ).toBe('fiat')
    })
})
