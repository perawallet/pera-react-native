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
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    getAccountChainStateRow: vi.fn(),
    getAccountHoldings: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    ...mocks,
}))

import { readEthereumSpendableBalance } from '../spendable-balance'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SENDER = '0x00000000000000000000000000000000000000aa'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ACCOUNT: WalletAccount = {
    id: 'sender',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: SENDER } },
}

describe('readEthereumSpendableBalance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('offers the whole token holding, since gas is paid in ether', async () => {
        mocks.getAccountHoldings.mockResolvedValue([
            { assetId: USDC, amount: new Decimal(250), native: null },
        ])

        const result = await readEthereumSpendableBalance({
            account: ACCOUNT,
            asset: { chainId: 'ethereum', assetId: USDC },
            scope: SCOPE,
            fee: new Decimal(21_000),
        })

        expect(result).toEqual({
            balance: new Decimal(250),
            max: new Decimal(250),
            reserved: new Decimal(0),
        })
    })

    it('never offers a negative amount of ether when the fee exceeds the balance', async () => {
        mocks.getAccountChainStateRow.mockResolvedValue({
            accountAddress: SENDER,
            nativeBalance: new Decimal(10),
            chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
        })

        const result = await readEthereumSpendableBalance({
            account: ACCOUNT,
            asset: { chainId: 'ethereum', assetId: 'native' },
            scope: SCOPE,
            fee: new Decimal(21_000),
        })

        expect(result.max).toEqual(new Decimal(0))
    })
})
