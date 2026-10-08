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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    AccountChainState,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { addressOn } from '../../credentials'
import { useAccountChainStateStore } from '../../store'
import type { WalletAccount } from '../../models'
import { buildTestAccount } from '../../__tests__/accountFactory'
import { useAuthorityOf } from '../useAuthorityOf'

const mainnet: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const testnet: ChainScope = { chainId: 'algorand', networkId: 'testnet' }

const chainState = (
    authAddress?: string,
    minBalance = 100000,
): AccountChainState => ({
    family: 'algorand',
    minBalance: new Decimal(minBalance),
    status: 'Offline',
    totalAssetsOptedIn: 0,
    totalCreatedAssets: 0,
    totalAppsOptedIn: 0,
    ...(authAddress ? { authAddress } : {}),
})

describe('useAuthorityOf', () => {
    let account: WalletAccount
    let address: string

    const write = (scope: ChainScope, state: AccountChainState, to = address) =>
        act(() =>
            useAccountChainStateStore
                .getState()
                .setAccountChainState(scope, to, state),
        )

    const mount = (target?: WalletAccount, scope = mainnet) => {
        let renders = 0
        const hook = renderHook(() => {
            renders++
            return useAuthorityOf(target ?? account, scope)
        })
        return { ...hook, renders: () => renders }
    }

    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        account = buildTestAccount('watch')
        address = addressOn(account, mainnet)!
    })

    it("returns the slice entry's authority for the scope", () => {
        write(mainnet, chainState('AUTH'))

        const { result } = mount()

        expect(result.current).toBe('AUTH')
    })

    it('returns null for a scope whose entry has no authority, even if another network has one', () => {
        write(testnet, chainState('AUTH'))
        write(mainnet, chainState())

        const { result } = mount()

        expect(result.current).toBeNull()
    })

    it("re-renders with the new value when this scope's entry changes", () => {
        write(mainnet, chainState('AUTH'))
        const { result, renders } = mount()
        const before = renders()

        write(mainnet, chainState('NEW'))
        expect(result.current).toBe('NEW')
        expect(renders()).toBe(before + 1)

        write(mainnet, chainState())
        expect(result.current).toBeNull()
        expect(renders()).toBe(before + 2)
    })

    it("does not re-render when another scope's entry changes", () => {
        write(mainnet, chainState('AUTH'))
        const { result, renders } = mount()
        const before = renders()

        write(testnet, chainState('OTHER'))

        expect(result.current).toBe('AUTH')
        expect(renders()).toBe(before)
    })

    it("ignores another address's entry on the same scope", () => {
        write(mainnet, chainState('AUTH'))
        const { result, renders } = mount()
        const before = renders()

        write(mainnet, chainState('OTHER'), 'SOMEONE-ELSE')

        expect(result.current).toBe('AUTH')
        expect(renders()).toBe(before)
    })

    it('does not re-render when the entry changes but its authority does not', () => {
        write(mainnet, chainState('AUTH'))
        const { renders } = mount()
        const before = renders()

        write(mainnet, chainState('AUTH', 200000))

        expect(renders()).toBe(before)
    })

    it("falls back to the account's fields until the slice holds the scope", () => {
        const legacy = {
            ...account,
            rekeyAddressByNetwork: { mainnet: 'MAP' },
        }
        const { result } = mount(legacy)
        expect(result.current).toBe('MAP')

        write(mainnet, chainState('NEW'))

        expect(result.current).toBe('NEW')
    })

    it('returns to the fallback when the slice is reset', () => {
        write(mainnet, chainState('AUTH'))
        const { result } = mount()
        expect(result.current).toBe('AUTH')

        act(() => useAccountChainStateStore.getState().resetState())

        expect(result.current).toBeNull()
    })

    it('is null on a chain the account has no address for', () => {
        const { result } = mount(account, {
            chainId: 'ethereum',
            networkId: 'mainnet',
        } as ChainScope)

        expect(result.current).toBeNull()
    })
})
