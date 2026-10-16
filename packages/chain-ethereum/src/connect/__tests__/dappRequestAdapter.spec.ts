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

import { describe, expect, it } from 'vitest'
import { buildAccount } from '@perawallet/wallet-core-accounts'
import { testChainContext } from '../../__tests__/context'
import { createEthereumDappRequestAdapter } from '../dappRequestAdapter'
import { ethereumWalletConnectSupport } from '../walletConnect'

const watch = buildAccount({
    custody: { kind: 'watch' },
    chainId: 'ethereum',
    chains: {
        ethereum: { address: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' },
    },
})

const adapter = createEthereumDappRequestAdapter(testChainContext())

describe('ethereumDappRequestAdapter', () => {
    it('is keyed by the Ethereum chain id and serves eip155 over WalletConnect', () => {
        expect(adapter.chainId).toBe('ethereum')
        expect(adapter.walletConnect).toBe(ethereumWalletConnectSupport)
    })

    it('reports its own networks and withholds any other', () => {
        expect(
            adapter.resolveReportedNetwork(
                { chainId: 'ethereum', networkId: 'sepolia' },
                undefined,
            ),
        ).toBe('sepolia')
        expect(
            adapter.resolveReportedNetwork(
                { chainId: 'ethereum', networkId: 'custom' },
                undefined,
            ),
        ).toBeUndefined()
        expect(
            adapter.resolveReportedNetwork(
                { chainId: 'algorand', networkId: 'mainnet' },
                undefined,
            ),
        ).toBeUndefined()
    })

    it('parses no signing payload from params', () => {
        expect(
            adapter.parseSigningParams('send-transaction', {}),
        ).toMatchObject({ ok: false, reason: 'missing' })
    })

    it('accepts no transaction group, whatever it holds', () => {
        expect(adapter.validateTransactionPayload([{ txn: 'AA==' }])).toEqual({
            ok: false,
            message: expect.stringContaining('eth_sendTransaction'),
        })
    })

    it('refuses to enqueue a transaction group, synchronously', () => {
        const enqueue = adapter.useEnqueueTransactionSigning()

        expect(() =>
            enqueue(
                { group: [], authorizedAccounts: [] },
                {} as Parameters<typeof enqueue>[1],
            ),
        ).toThrow()
    })

    it('answers no empty signatures', () => {
        expect(adapter.emptySignaturesFor(['0xabc'])).toEqual({})
    })

    it("labels an account with the app's own kind id", () => {
        expect(
            adapter.accountTypeOf(watch, [watch], {
                chainId: 'ethereum',
                networkId: 'mainnet',
            }),
        ).toBe('watch')
    })
    describe('sendTransaction.validate', () => {
        const sending = adapter.sendTransaction
        if (!sending) throw new Error('Ethereum sends transactions for dApps')
        const [from] = [watch.chains.ethereum?.address ?? '']
        const to = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'

        it('reads the active network from the context, which a request must name', () => {
            expect(
                sending.validate({ from, to, chainId: '0x1' }, [from]),
            ).toMatchObject({ ok: true })
            expect(
                sending.validate({ from, to, chainId: '0xaa36a7' }, [from]),
            ).toMatchObject({ ok: false, failure: 'invalid-params' })
        })

        it('hands the session accounts to the field rules', () => {
            expect(sending.validate({ from, to }, [])).toMatchObject({
                ok: false,
                failure: 'unauthorized-account',
            })
        })
    })
})
