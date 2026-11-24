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

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@test-utils/render'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import {
    registerEvmChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useAssetListViewStore } from '../../../hooks/useAssetListViewStore'
import { useAccountSelectionCopy } from '../useAccountSelectionCopy'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-accounts')>(),
)

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) => ({
        addressCopiedTitle: `common.address_copied.${family}`,
    }),
}))

vi.mock('@hooks/useLanguage')

const ALGO = 'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'
const EVM = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const EVM_CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const accountWith = (chains: Record<string, object>): WalletAccount =>
    ({ id: 'fred', chains }) as unknown as WalletAccount

const multichain = accountWith({
    algorand: { address: ALGO, enabledBy: 'created' },
    ethereum: { address: EVM, enabledBy: 'created' },
})

const short = (chainId: string, address: string) =>
    addressCodecs.get(chainId).truncate(address)

describe('useAccountSelectionCopy', () => {
    beforeEach(() => {
        restoreAlgorandOnlyChains()
        addressCodecs.reset()
        registerAlgorandAddressCodec()
        registerEvmChain('ethereum')
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
    })

    afterAll(() => {
        restoreAlgorandOnlyChains()
        addressCodecs.reset()
    })

    it('copies the 0x address of an EVM-first account and names it in the toast', () => {
        const account = accountWith({
            algorand: { address: ALGO, enabledBy: 'created' },
            ethereum: { address: EVM, enabledBy: 'discovery' },
        })

        const { result } = renderHook(() => useAccountSelectionCopy(account))

        expect(result.current).toEqual({
            copyValue: EVM_CHECKSUMMED,
            copyOptions: {
                title: 'common.address_copied.evm',
                body: short('ethereum', EVM),
            },
        })
    })

    it('copies the 0x address under an EVM network filter', () => {
        useAssetListViewStore.getState().setSelectedChainId('ethereum')

        const { result } = renderHook(() => useAccountSelectionCopy(multichain))

        expect(result.current?.copyValue).toBe(EVM_CHECKSUMMED)
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
            copyValue: ALGO,
            copyOptions: {
                title: 'common.address_copied.algorand',
                body: short('algorand', ALGO),
            },
        })
    })

    it('copies the Algorand address of a default multichain account', () => {
        const { result } = renderHook(() => useAccountSelectionCopy(multichain))

        expect(result.current?.copyValue).toBe(ALGO)
        expect(result.current?.copyOptions.title).toBe(
            'common.address_copied.algorand',
        )
    })

    it('copies the Algorand address of an Algorand-only account under an EVM filter', () => {
        useAssetListViewStore.getState().setSelectedChainId('ethereum')
        const account = accountWith({
            algorand: { address: ALGO, enabledBy: 'created' },
        })

        const { result } = renderHook(() => useAccountSelectionCopy(account))

        expect(result.current).toEqual({
            copyValue: ALGO,
            copyOptions: {
                title: 'common.address_copied.algorand',
                body: short('algorand', ALGO),
            },
        })
    })

    it('copies the raw address of an account held only on a chain this build does not register', () => {
        restoreAlgorandOnlyChains()
        const account = accountWith({
            ethereum: { address: EVM, enabledBy: 'created' },
        })

        const { result } = renderHook(() => useAccountSelectionCopy(account))

        expect(result.current).toEqual({ copyValue: EVM, copyOptions: {} })
    })

    it('copies nothing without an account', () => {
        const { result } = renderHook(() => useAccountSelectionCopy(null))

        expect(result.current).toBeUndefined()
    })
})
