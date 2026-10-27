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
import { DappRequestCodedError } from '@perawallet/wallet-core-connections'
import { findTransactionBatch } from '@perawallet/wallet-core-signing'
import {
    ETHEREUM_CAIP2_NAMESPACE,
    ETHEREUM_WC_V2_METHOD,
    createEvmWalletConnectSupport,
} from '../walletConnect'
import { testChainContext } from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    findTransactionBatch: vi.fn(),
}))

const support = createEvmWalletConnectSupport(testChainContext(), ETHEREUM)

const v2 = support.v2
if (!v2) throw new Error('Ethereum serves WalletConnect v2')

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

describe('namespace', () => {
    it('is eip155', () => {
        expect(support.namespace).toBe(ETHEREUM_CAIP2_NAMESPACE)
        expect(support.namespace).toBe('eip155')
    })
})

describe('caip2ChainIdFor / networkForCaip2ChainId', () => {
    it('maps eip155:1 to mainnet and back', () => {
        expect(support.caip2ChainIdFor('mainnet')).toBe('eip155:1')
        expect(support.networkForCaip2ChainId('eip155:1')).toBe('mainnet')
    })

    it('maps sepolia and back', () => {
        expect(support.caip2ChainIdFor('sepolia')).toBe('eip155:11155111')
        expect(support.networkForCaip2ChainId('eip155:11155111')).toBe(
            'sepolia',
        )
    })

    it('names no network for a chain the wallet does not declare', () => {
        expect(support.networkForCaip2ChainId('eip155:137')).toBeNull()
        expect(support.caip2ChainIdFor('custom')).toBeNull()
    })
})

describe('v2.methods', () => {
    it('is exactly the eleven served methods', () => {
        expect(v2.methods).toEqual([
            'eth_sendTransaction',
            'personal_sign',
            'eth_signTypedData_v4',
            'wallet_switchEthereumChain',
            'wallet_sendCalls',
            'eth_accounts',
            'eth_requestAccounts',
            'eth_chainId',
            'wallet_getCapabilities',
            'wallet_getCallsStatus',
            'wallet_showCallsStatus',
        ])
    })

    it.each([
        'eth_signTransaction',
        'eth_sendRawTransaction',
        'eth_sign',
        'wallet_addEthereumChain',
    ])('never lists %s', method => {
        expect(v2.methods).not.toContain(method)
        expect(v2.handleRequest(method, [])).toEqual({ kind: 'unsupported' })
    })

    it('asks the user only for the five signing methods', () => {
        expect(v2.signingMethods).toEqual(v2.methods.slice(0, 5))
    })
})

describe('v2.handleRequest', () => {
    it('routes eth_sendTransaction on its first positional param', () => {
        const transaction = { to: ADDRESS, value: '0x1' }

        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.sendTransaction, [
                transaction,
            ]),
        ).toEqual({
            kind: 'operation',
            type: 'send-transaction',
            params: transaction,
        })
    })

    it('routes personal_sign and eth_signTypedData_v4 with their params as sent', () => {
        const personal = ['0x68656c6c6f', ADDRESS]
        const typed = [ADDRESS, '{"types":{}}']

        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.personalSign, personal),
        ).toEqual({
            kind: 'operation',
            type: 'sign-message',
            params: personal,
        })
        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.signTypedDataV4, typed),
        ).toEqual({
            kind: 'operation',
            type: 'sign-typed-data',
            params: typed,
        })
    })

    it('answers eth_accounts and eth_requestAccounts with the addresses', () => {
        for (const method of [
            ETHEREUM_WC_V2_METHOD.accounts,
            ETHEREUM_WC_V2_METHOD.requestAccounts,
        ]) {
            const route = v2.handleRequest(method, [])
            if (route.kind !== 'public-data') throw new Error('not public')

            expect(route.answer([ADDRESS], 'mainnet')).toEqual([ADDRESS])
        }
    })

    it('answers eth_chainId in hex per network, and null for an undeclared one', () => {
        const route = v2.handleRequest(ETHEREUM_WC_V2_METHOD.chainId, [])
        if (route.kind !== 'public-data') throw new Error('not public')

        expect(route.answer([], 'mainnet')).toBe('0x1')
        expect(route.answer([], 'sepolia')).toBe('0xaa36a7')
        expect(route.answer([], 'custom')).toBeNull()
    })
})

describe('wallet_switchEthereumChain', () => {
    const switchTo = (chainId: unknown) =>
        v2.handleRequest(ETHEREUM_WC_V2_METHOD.switchChain, [{ chainId }])

    // Mode-blind: whether the target is the selected network is the handler's call.
    it.each([
        ['0x1', 'mainnet'],
        ['0xaa36a7', 'sepolia'],
        ['0xAA36A7', 'sepolia'],
    ])('routes %s to %s', (chainId, networkId) => {
        expect(switchTo(chainId)).toEqual({ kind: 'switch-network', networkId })
    })

    it('refuses a chain the wallet does not declare as unrecognized, 4902', () => {
        expect(switchTo('0x89')).toMatchObject({
            kind: 'refused',
            error: { code: 4902 },
        })
    })

    it.each([
        ['no params', undefined],
        ['an empty list', []],
        ['no chain id', [{}]],
        ['a decimal chain id', [{ chainId: '1' }]],
        ['a bare 0x', [{ chainId: '0x' }]],
        ['a non-string chain id', [{ chainId: 1 }]],
        ['a non-object entry', ['0x1']],
    ])('refuses %s as invalid params, -32602', (_name, params) => {
        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.switchChain, params),
        ).toMatchObject({ kind: 'refused', error: { code: -32_602 } })
    })

    it('never lists wallet_addEthereumChain, so it is refused as unsupported', () => {
        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.addChain, [
                { chainId: '0x89' },
            ]),
        ).toEqual({ kind: 'unsupported' })
    })
})

describe('v2.sessionEvents.chainChangedData', () => {
    const events = v2.sessionEvents
    if (!events) throw new Error('Ethereum emits session events')

    it('is the hex chain id of a declared network, and null for any other', () => {
        expect(events.chainChangedData('mainnet')).toBe('0x1')
        expect(events.chainChangedData('sepolia')).toBe('0xaa36a7')
        expect(events.chainChangedData('custom')).toBeNull()
    })
})

describe('EIP-5792 batches', () => {
    const CALL = { to: ADDRESS, value: '0x0', data: '0x' }
    const sendCalls = (batch: Record<string, unknown>) =>
        v2.handleRequest(ETHEREUM_WC_V2_METHOD.sendCalls, [
            {
                version: '2.0.0',
                chainId: '0x1',
                from: ADDRESS,
                atomicRequired: false,
                calls: [CALL],
                ...batch,
            },
        ])

    beforeEach(() => {
        vi.mocked(findTransactionBatch).mockReset()
    })

    it('refuses a batch that requires atomic execution with 5760, before anything is shown', () => {
        expect(sendCalls({ atomicRequired: true })).toEqual({
            kind: 'refused',
            error: { code: 5760, message: expect.any(String) },
        })
    })

    it.each([
        ['on the batch', { capabilities: { paymasterService: { url: 'x' } } }],
        [
            'on a call',
            { calls: [{ ...CALL, capabilities: { auxiliaryFunds: {} } }] },
        ],
    ])('refuses a required capability %s with 5700', (_, batch) => {
        expect(sendCalls(batch)).toEqual({
            kind: 'refused',
            error: { code: 5700, message: expect.any(String) },
        })
    })

    it('routes a batch whose capabilities are all optional as a send-batch with its params', () => {
        const params = [
            {
                version: '2.0.0',
                chainId: '0x1',
                atomicRequired: false,
                calls: [CALL],
                capabilities: { paymasterService: { optional: true } },
            },
        ]

        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.sendCalls, params),
        ).toEqual({ kind: 'operation', type: 'send-batch', params })
    })

    it('routes wallet_showCallsStatus as a show-batch of its id', () => {
        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.showCallsStatus, [
                'batch-1',
            ]),
        ).toEqual({
            kind: 'operation',
            type: 'show-batch',
            params: { batchId: 'batch-1' },
        })
    })

    const publicAnswer = (method: string, params: unknown) => {
        const route = v2.handleRequest(method, params)
        if (route.kind !== 'public-data')
            throw new Error(`${method} is not public data`)
        return (addresses: readonly string[]) =>
            Promise.resolve().then(() => route.answer(addresses, 'mainnet'))
    }

    it('reports atomic execution unsupported on every network for a held account', async () => {
        const answer = publicAnswer(ETHEREUM_WC_V2_METHOD.getCapabilities, [
            ADDRESS,
        ])

        await expect(answer([ADDRESS.toLowerCase()])).resolves.toEqual({
            '0x1': { atomic: { status: 'unsupported' } },
            '0xaa36a7': { atomic: { status: 'unsupported' } },
        })
    })

    it('reports capabilities only for the chains asked about', async () => {
        const answer = publicAnswer(ETHEREUM_WC_V2_METHOD.getCapabilities, [
            ADDRESS,
            ['0xaa36a7', '0x89'],
        ])

        await expect(answer([ADDRESS])).resolves.toEqual({
            '0xaa36a7': { atomic: { status: 'unsupported' } },
        })
    })

    it('refuses capabilities for an account the session does not hold with 4100', async () => {
        const answer = publicAnswer(ETHEREUM_WC_V2_METHOD.getCapabilities, [
            ADDRESS,
        ])

        await expect(answer([])).rejects.toMatchObject({ wireCode: 4100 })
    })

    it("refuses the status of a batch none of the session's accounts sent with 5730", async () => {
        vi.mocked(findTransactionBatch).mockResolvedValue(null)
        const answer = publicAnswer(ETHEREUM_WC_V2_METHOD.getCallsStatus, [
            'batch-1',
        ])

        const refusal = answer([ADDRESS])

        await expect(refusal).rejects.toBeInstanceOf(DappRequestCodedError)
        await expect(refusal).rejects.toMatchObject({ wireCode: 5730 })
        expect(findTransactionBatch).toHaveBeenCalledWith({
            chainId: 'ethereum',
            batchId: 'batch-1',
            senders: [ADDRESS],
        })
    })
})

describe('toWireResult', () => {
    it('answers a sent batch with its id', () => {
        expect(
            support.toWireResult({ type: 'send-batch', batchId: 'batch-1' }),
        ).toEqual({ id: 'batch-1' })
    })

    it('answers a shown batch with null', () => {
        expect(support.toWireResult({ type: 'show-batch' })).toBeNull()
    })

    it('answers a switch with null, which is what wallet_switchEthereumChain returns', () => {
        expect(support.toWireResult({ type: 'switch-network' })).toBeNull()
    })

    it('answers a sent transaction with its hash', () => {
        expect(
            support.toWireResult({ type: 'send-transaction', txId: '0xabc' }),
        ).toBe('0xabc')
    })

    it.each(['sign-message', 'sign-typed-data'] as const)(
        'answers a %s result as 0x-prefixed hex of the 65 signature bytes',
        type => {
            const signature = new Uint8Array(65).fill(0xab)

            expect(support.toWireResult({ type, signature })).toBe(
                `0x${'ab'.repeat(65)}`,
            )
        },
    )

    it('throws for a result kind Ethereum does not serve', () => {
        expect(() =>
            support.toWireResult({ type: 'sign-data', signatures: [] }),
        ).toThrow()
    })
})

describe('toWireErrorCode', () => {
    it.each([
        ['user-rejected', 4001],
        ['unauthorized-account', 4100],
        ['unsupported-method', 4200],
        ['unselected-chain', 4901],
        ['invalid-params', -32_602],
        ['limit-exceeded', -32_005],
    ] as const)('maps %s to %i', (failure, code) => {
        expect(support.toWireErrorCode?.(failure)).toBe(code)
    })
})
