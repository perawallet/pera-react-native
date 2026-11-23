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
import { renderHook } from '@test-utils/render'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useAssetListViewStore } from '../../../hooks/useAssetListViewStore'
import { useAccountSelectionCopy } from '../useAccountSelectionCopy'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            get: (id: string) => ({
                descriptor: { family: id === 'algorand' ? 'algorand' : 'evm' },
            }),
        },
    }),
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-contract')
    >()),
    addressCodecs: {
        get: () => ({
            isValid: () => true,
            normalize: (address: string) => `normalized:${address}`,
            truncate: (address: string) => `short:${address}`,
        }),
    },
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) => ({
        addressCopiedTitle: `common.address_copied.${family}`,
    }),
}))

vi.mock('@hooks/useLanguage')

const ALGO = 'JUELDALGOADDRESSIV2QA'
const EVM = '0x4b7f00000000000000000000000000000000cb15'

const accountWith = (chains: Record<string, object>): WalletAccount =>
    ({ id: 'fred', chains }) as unknown as WalletAccount

const multichain = accountWith({
    algorand: { address: ALGO, enabledBy: 'created' },
    ethereum: { address: EVM, enabledBy: 'created' },
})

describe('useAccountSelectionCopy', () => {
    beforeEach(() => {
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
    })

    it('copies the 0x address of an EVM-first account and names it in the toast', () => {
        const account = accountWith({
            algorand: { address: ALGO, enabledBy: 'created' },
            ethereum: { address: EVM, enabledBy: 'discovery' },
        })

        const { result } = renderHook(() => useAccountSelectionCopy(account))

        expect(result.current).toEqual({
            copyValue: `normalized:${EVM}`,
            copyOptions: {
                title: 'common.address_copied.evm',
                body: `short:${EVM}`,
            },
        })
    })

    it('copies the 0x address under an EVM network filter', () => {
        useAssetListViewStore.getState().setSelectedChainId('ethereum')

        const { result } = renderHook(() => useAccountSelectionCopy(multichain))

        expect(result.current?.copyValue).toBe(`normalized:${EVM}`)
        expect(result.current?.copyOptions.title).toBe(
            'common.address_copied.evm',
        )
    })

    it('copies the Algorand address under the Algorand filter, even on an EVM-first account', () => {
        useAssetListViewStore.getState().setSelectedChainId('algorand')
        const account = accountWith({
            algorand: { address: ALGO, enabledBy: 'created' },
            ethereum: { address: EVM, enabledBy: 'discovery' },
        })

        const { result } = renderHook(() => useAccountSelectionCopy(account))

        expect(result.current).toEqual({
            copyValue: `normalized:${ALGO}`,
            copyOptions: {
                title: 'common.address_copied.algorand',
                body: `short:${ALGO}`,
            },
        })
    })

    it('copies nothing without an account', () => {
        const { result } = renderHook(() => useAccountSelectionCopy(null))

        expect(result.current).toBeUndefined()
    })
})
