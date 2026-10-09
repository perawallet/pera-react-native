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
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    getAuthAccount,
    getRekeyAccount,
    resolveAuthAccount,
    resolveSignerForAccount,
} from '../signer-resolution'
import { DelegationTargetNotFoundError } from '../errors'
import { type WalletAccount } from '../models'
import { useAccountChainStateStore } from '../store'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from './fakeAccountsChain'

const account = (
    address: string,
    extra: Partial<WalletAccount> = {},
): WalletAccount =>
    ({
        id: address,
        custody: { kind: 'local', seed: null },
        address,
        keyPairId: 'k',
        ...extra,
    }) as WalletAccount

beforeEach(() => {
    registerFakeAccountsChain()
    useAccountChainStateStore.getState().resetState()
    useNetworkStore.getState().setNetwork('mainnet')
})

describe('signer resolution', () => {
    it('routes to the adapter registered for the chain asked about', () => {
        const a = account('A')
        const accounts = [a]
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.resolveSigner).mockReturnValue({
            kind: 'watch',
            account: a,
        })

        expect(resolveSignerForAccount(a, accounts, FAKE_CHAIN_ID)).toEqual({
            kind: 'watch',
            account: a,
        })
        expect(adapter.resolveSigner).toHaveBeenCalledWith(
            a,
            accounts,
            MAINNET_SCOPE,
        )
    })

    it('asks the adapter on the selected network', () => {
        const a = account('A')
        const { adapter } = fakeAccountsChain()
        useNetworkStore.getState().setNetwork('testnet')

        getAuthAccount(a, [a], FAKE_CHAIN_ID)
        resolveSignerForAccount(a, [a], FAKE_CHAIN_ID)

        expect(adapter.getAuthAccount).toHaveBeenCalledWith(
            a,
            [a],
            TESTNET_SCOPE,
        )
        expect(adapter.resolveSigner).toHaveBeenCalledWith(
            a,
            [a],
            TESTNET_SCOPE,
        )
    })

    it("returns the chain's auth account, and derives the rest from it", () => {
        const auth = account('S')
        const a = account('A')
        seedAuthority('A', 'S')
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.getAuthAccount).mockReturnValue(auth)

        expect(getAuthAccount(a, [a, auth], FAKE_CHAIN_ID)).toBe(auth)
        expect(resolveAuthAccount(a, [a, auth], FAKE_CHAIN_ID)).toBe(auth)
        expect(getRekeyAccount('A', [a, auth], FAKE_CHAIN_ID)).toBe(auth)
    })

    it('throws DelegationTargetNotFoundError when the chain finds no auth account', () => {
        const a = account('A')
        seedAuthority('A', 'GONE')
        vi.mocked(fakeAccountsChain().adapter.getAuthAccount).mockReturnValue(
            null,
        )

        expect(() => resolveAuthAccount(a, [a], FAKE_CHAIN_ID)).toThrow(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    params: { authorityAddress: 'GONE' },
                }),
            }),
        )
        expect(() => resolveAuthAccount(a, [a], FAKE_CHAIN_ID)).toThrow(
            DelegationTargetNotFoundError,
        )
    })

    it('throws for a chain with no registered adapter', () => {
        const a = account('A')

        expect(() =>
            resolveSignerForAccount(a, [a], 'nowhere' as typeof FAKE_CHAIN_ID),
        ).toThrow(ChainAdapterNotRegisteredError)
    })
})
