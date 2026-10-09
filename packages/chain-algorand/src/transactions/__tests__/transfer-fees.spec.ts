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

// @vitest-environment node
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    type ChainId,
    type TransferIntent,
} from '@perawallet/wallet-core-chain-contract'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import { mockAlgodTransactionParams } from '../../test-handlers'

vi.mock('../../blockchain/fees/getMinimumFeeConfig', () => ({
    getMinimumFeeConfig: () => ({
        minTxnFee: 1000n,
        pqMultiplier: 3n,
        assetMbr: 100_000n,
        baseAccountMbr: 100_000n,
    }),
}))

import { estimateAlgorandTransferFee } from '../transfer-fees'

const QUANTUM = 'QADDR'
const ED25519 = 'AADDR'

const quantum = {
    id: 'q1',
    address: QUANTUM,
    custody: { kind: 'local', seed: 'quantum' },
    keyPairId: 'kp-quantum',
} as WalletAccount

const ed25519 = {
    id: 'a1',
    address: ED25519,
    custody: { kind: 'local', seed: null },
    keyPairId: 'kp-algo25',
} as WalletAccount

const context = { scope: scopeForLegacyNetwork('mainnet') }
const ALGO = { chainId: 'algorand' as ChainId, assetId: '0' }

const sendFrom = (from: string): TransferIntent => ({
    kind: 'transfer',
    from,
    to: 'RECEIVER',
    assetRef: ALGO,
    amount: new Decimal(1),
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('estimateAlgorandTransferFee', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
        useAccountsStore.setState({ accounts: [quantum, ed25519] })
        server.use(mockAlgodTransactionParams())
    })

    it('prices an ed25519 sender at the flat minimum fee, in µAlgo', async () => {
        const estimate = await estimateAlgorandTransferFee(
            sendFrom(ED25519),
            context,
        )

        expect(estimate.assetRef).toEqual(ALGO)
        expect(estimate.amount.equals(1000)).toBe(true)
    })

    it('adds the post-quantum surcharge for a quantum sender', async () => {
        const estimate = await estimateAlgorandTransferFee(
            sendFrom(QUANTUM),
            context,
        )

        expect(estimate.amount.equals(3000)).toBe(true)
    })

    it('prices a rekeyed sender at its quantum authority’s rate', async () => {
        seedAuthority(ED25519, QUANTUM)

        const estimate = await estimateAlgorandTransferFee(
            sendFrom(ED25519),
            context,
        )

        expect(estimate.amount.equals(3000)).toBe(true)
    })

    it('multiplies the congested suggested fee once, not the configured base', async () => {
        server.use(
            mockAlgodTransactionParams({ response: { 'min-fee': 2000 } }),
        )

        const estimate = await estimateAlgorandTransferFee(
            sendFrom(QUANTUM),
            context,
        )

        expect(estimate.amount.equals(6000)).toBe(true)
    })

    it('prices an opt-in by the opting-in account', async () => {
        const estimate = await estimateAlgorandTransferFee(
            {
                kind: 'asset-opt-in',
                account: QUANTUM,
                assetRef: { ...ALGO, assetId: '31566704' },
            },
            context,
        )

        expect(estimate.amount.equals(3000)).toBe(true)
    })

    it('fails when the node cannot be asked for its minimum fee', async () => {
        server.use(
            http.get('*/v2/transactions/params', () => HttpResponse.error()),
        )

        await expect(
            estimateAlgorandTransferFee(sendFrom(ED25519), context),
        ).rejects.toThrow()
    })

    it('refuses a scope that is not Algorand', async () => {
        await expect(
            estimateAlgorandTransferFee(sendFrom(ED25519), {
                scope: { chainId: 'ethereum', networkId: 'mainnet' },
            }),
        ).rejects.toThrow('Not an Algorand scope')
    })
})
