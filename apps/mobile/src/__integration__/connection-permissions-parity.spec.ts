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

// A signing method no permission names would drop off the consent list, so
// every method a registered chain asks the user about must map to one.
import { describe, expect, it, vi } from 'vitest'
import { CHAIN_IDS } from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { EIP1193_PERMISSION_METHODS } from '@perawallet/wallet-core-dapp'
import { toConnectionPermissions } from '../modules/walletconnect/utils/connectionPermissions'

// The integration setup registers the real chains after this mock applies, so
// the suite sees every chain the app can ship, not just the default build's.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    const { CHAIN_IDS: allChainIds } =
        await import('@perawallet/wallet-core-chain-contract')
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: [...allChainIds], capabilities: {} },
        },
    }
})

const grantsMoreThanReading = (method: string): boolean =>
    toConnectionPermissions([method]).length > 1

describe('connection permissions cover every signing method', () => {
    it('maps each registered chain’s WalletConnect v2 signing methods', () => {
        const signing = CHAIN_IDS.flatMap(chainId =>
            dappRequestChainAdapters.has(chainId)
                ? (dappRequestChainAdapters.get(chainId).walletConnect.v2
                      ?.signingMethods ?? [])
                : [],
        )

        expect(signing).toContain('eth_sendTransaction')
        expect(signing).toContain('algo_signTxn')
        expect(
            signing.filter(method => !grantsMoreThanReading(method)),
        ).toEqual([])
    })

    it('shows the in-app browser’s connect grant as reading accounts and switching networks', () => {
        expect(toConnectionPermissions(EIP1193_PERMISSION_METHODS)).toEqual([
            'view-accounts',
            'switch-networks',
        ])
    })
})
