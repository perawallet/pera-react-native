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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { accountsChainAdapters } from '../chain-adapter'
import type { WalletAccount } from '../models'
import { signingAccountAddressesOn } from '../signingAccountAddresses'
import { useAccountChainStateStore, useAccountsStore } from '../store'
import { testAccount } from './accountFactory'
import {
    FAKE_CHAIN_ID,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

const account = (
    address: string,
    extra: Partial<WalletAccount> = {},
): WalletAccount => testAccount('local', address, { id: address, ...extra })

const OTHER_CHAIN = 'other' as ChainId

const registerOtherChain = (
    canSign: (held: WalletAccount) => boolean,
): void => {
    accountsChainAdapters.register({
        ...fakeAccountsChain().adapter,
        chainId: OTHER_CHAIN,
        resolveSigner: vi.fn((held: WalletAccount) =>
            canSign(held)
                ? { kind: 'ok' as const, signer: held }
                : { kind: 'watch' as const, account: held },
        ),
    })
}

beforeEach(() => {
    registerFakeAccountsChain()
    useAccountChainStateStore.getState().resetState()
    useAccountsStore.setState({ accounts: [] })
})

describe('signingAccountAddressesOn', () => {
    it('lists the chain address of each account something held can sign for', () => {
        const spanning = account('A', {
            name: 'Main',
            chains: {
                [FAKE_CHAIN_ID]: { address: 'A', keyPairId: 'a-key' },
                [OTHER_CHAIN]: { address: '0xA', keyPairId: 'other-key' },
            },
        })
        registerOtherChain(() => true)
        useAccountsStore.setState({ accounts: [spanning] })

        expect(signingAccountAddressesOn(OTHER_CHAIN)).toEqual([
            { address: '0xA', name: 'Main' },
        ])
    })

    it('leaves out an account the chain cannot sign for and one with no entry on it', () => {
        const watchOnly = account('W', {
            chains: {
                [FAKE_CHAIN_ID]: { address: 'W', keyPairId: 'w-key' },
                [OTHER_CHAIN]: { address: '0xW', keyPairId: 'w-other' },
            },
        })
        const noEntry = account('N')
        registerOtherChain(held => held.id !== 'W')
        useAccountsStore.setState({ accounts: [watchOnly, noEntry] })

        expect(signingAccountAddressesOn(OTHER_CHAIN)).toEqual([])
    })

    it('names an unnamed account by its address', () => {
        const unnamed = account('A', { name: undefined })
        useAccountsStore.setState({ accounts: [unnamed] })

        expect(signingAccountAddressesOn(FAKE_CHAIN_ID)).toEqual([
            { address: 'A', name: 'A' },
        ])
    })
})
