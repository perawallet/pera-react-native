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

import { describe, expect, it, vi } from 'vitest'
import { kmsCore } from '@perawallet/wallet-core-kms'
import {
    deriveHdAccount,
    describeHolding,
    fetchHoldingAcquisitionOrder,
    fetchHoldingBalanceHistory,
    fetchPortfolioHistory,
    hdDeriveOpts,
} from '../chain-adapter'
import { HdAccountsUnsupportedError } from '../errors'
import {
    FAKE_LOCAL_KEY_KINDS,
    MAINNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

describe('hdDeriveOpts', () => {
    it("takes the scheme from the chain's HD key kind and the network from the scope", () => {
        expect(hdDeriveOpts(MAINNET_SCOPE)).toEqual({
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
    })

    it('refuses a chain that declares no HD key kind', () => {
        registerFakeAccountsChain({
            localKeyKinds: FAKE_LOCAL_KEY_KINDS.filter(kind => !kind.isHd),
        })

        expect(() => hdDeriveOpts(MAINNET_SCOPE)).toThrow(
            HdAccountsUnsupportedError,
        )
    })
})

describe('deriveHdAccount', () => {
    it('derives through the registered key derivation with the shared KMS core', async () => {
        const { deriveAccount } = fakeAccountsChain().derivation

        const derived = await deriveHdAccount(MAINNET_SCOPE, 'seed-1', {
            account: 2,
            keyIndex: 5,
        })

        expect(deriveAccount).toHaveBeenCalledWith(kmsCore, 'seed-1', 2, 5, {
            scheme: 'ed25519',
            networkId: 'mainnet',
        })
        expect(derived.keyPairId).toBe('seed-1-acc2-idx5-dt9')
    })
})

describe('operations a chain may leave out', () => {
    const bare = () =>
        registerFakeAccountsChain({
            fetchHoldingAcquisitionOrder: undefined,
            fetchPortfolioHistory: undefined,
            fetchHoldingBalanceHistory: undefined,
            describeHolding: undefined,
        })

    it('answers an empty acquisition order without asking the chain', async () => {
        bare()

        await expect(
            fetchHoldingAcquisitionOrder('ADDR', MAINNET_SCOPE),
        ).resolves.toEqual(new Map())
    })

    it('answers no portfolio history source and an empty holding history', async () => {
        bare()

        await expect(
            fetchPortfolioHistory(['ADDR'], 'one-day', MAINNET_SCOPE),
        ).resolves.toBeNull()
        await expect(
            fetchHoldingBalanceHistory(
                'ADDR',
                '1',
                'one-day',
                'USD',
                MAINNET_SCOPE,
            ),
        ).resolves.toEqual([])
    })

    it('places no restriction on a holding', () => {
        bare()

        expect(
            describeHolding('algorand', { family: 'algorand', isFrozen: true }),
        ).toEqual({ restriction: null })
    })

    it('places no restriction on a holding with no native data, without asking the chain', () => {
        const { adapter } = fakeAccountsChain()

        expect(describeHolding('algorand', null)).toEqual({ restriction: null })
        expect(adapter.describeHolding).not.toHaveBeenCalled()
    })

    it('defers to the chain when it declares the operation', async () => {
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.fetchHoldingAcquisitionOrder!).mockResolvedValue(
            new Map([['1', 5]]),
        )

        await expect(
            fetchHoldingAcquisitionOrder('ADDR', MAINNET_SCOPE),
        ).resolves.toEqual(new Map([['1', 5]]))
        expect(
            describeHolding('algorand', { family: 'algorand', isFrozen: true }),
        ).toEqual({ restriction: 'transferBlocked' })
    })
})
