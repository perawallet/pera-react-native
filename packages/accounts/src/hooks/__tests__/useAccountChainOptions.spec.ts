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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    EVM_CHAINS,
    EVM_KEY_ADDRESS,
    POLYGON,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'
import {
    accountChainOptions,
    useAccountChainOptionsResolver,
} from '../useAccountChainOptions'

const ledgerApps = vi.hoisted(() => new Set<string>())

vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    hasLedgerAppDriver: (chainId: string) => ledgerApps.has(chainId),
}))

const everyChain = () => true

describe('accountChainOptions', () => {
    beforeEach(() => {
        ledgerApps.clear()
        registerChainFamilies()
    })

    test('lists the enabled chains first, then the eligible ones in the same family, each in registry order with the family address', () => {
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            [POLYGON]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
            [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
        })

        expect(accountChainOptions(hd, everyChain)).toEqual([
            { chainId: ETHEREUM, isEnabled: true, address: EVM_KEY_ADDRESS },
            { chainId: POLYGON, isEnabled: true, address: EVM_KEY_ADDRESS },
            ...EVM_CHAINS.filter(
                chainId => chainId !== ETHEREUM && chainId !== POLYGON,
            ).map(chainId => ({
                chainId,
                isEnabled: false,
                address: EVM_KEY_ADDRESS,
            })),
        ])
    })

    test('leaves out the chains the flow has switched off', () => {
        const watched = buildTestAccount(TEST_CUSTODY.watch, {
            [ETHEREUM]: { address: EVM_KEY_ADDRESS },
        })

        expect(
            accountChainOptions(watched, chainId => chainId !== BASE).map(
                option => option.chainId,
            ),
        ).not.toContain(BASE)
    })

    test('with every family in reach, offers a chain in a new family without an address', () => {
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'k' },
        })

        const options = accountChainOptions(hd, everyChain, 'all')

        expect(options[0]).toEqual({
            chainId: ALGORAND,
            isEnabled: true,
            address: ALGORAND_ADDRESS,
        })
        expect(options).toContainEqual({
            chainId: ETHEREUM,
            isEnabled: false,
            address: undefined,
        })
        expect(
            accountChainOptions(hd, everyChain).map(option => option.chainId),
        ).toEqual([ALGORAND])
    })

    test('with every family in reach, still offers a hardware account only its enabled chains', () => {
        ledgerApps.add(ETHEREUM)
        const ledger = buildTestAccount(TEST_CUSTODY.hardware, {
            [ALGORAND]: { address: ALGORAND_ADDRESS },
        })

        expect(accountChainOptions(ledger, everyChain, 'all')).toEqual([
            { chainId: ALGORAND, isEnabled: true, address: ALGORAND_ADDRESS },
        ])
    })

    test('offers a hardware account only the chains it is enabled on', () => {
        ledgerApps.add(ETHEREUM)
        const ledger = buildTestAccount(TEST_CUSTODY.hardware, {
            [ALGORAND]: { address: ALGORAND_ADDRESS },
        })

        expect(accountChainOptions(ledger, everyChain)).toEqual([
            { chainId: ALGORAND, isEnabled: true, address: ALGORAND_ADDRESS },
        ])
    })
})

describe('useAccountChainOptionsResolver', () => {
    beforeEach(() => {
        registerChainFamilies(undefined, [BASE])
    })

    test('limits the options to the chains with the capability on', () => {
        const watched = buildTestAccount(TEST_CUSTODY.watch, {
            [ETHEREUM]: { address: EVM_KEY_ADDRESS },
        })

        const { result } = renderHook(() =>
            useAccountChainOptionsResolver('receive'),
        )

        expect(result.current(watched).map(option => option.chainId)).toEqual(
            EVM_CHAINS.filter(chainId => chainId !== BASE) as ChainId[],
        )
    })
})
