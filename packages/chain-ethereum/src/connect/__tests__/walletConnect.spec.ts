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
import {
    ETHEREUM_CAIP2_NAMESPACE,
    ETHEREUM_WC_V2_METHOD,
    ethereumWalletConnectSupport as support,
} from '../walletConnect'

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
    it('is exactly the seven served methods', () => {
        expect(v2.methods).toEqual([
            'eth_sendTransaction',
            'personal_sign',
            'eth_signTypedData_v4',
            'wallet_switchEthereumChain',
            'eth_accounts',
            'eth_requestAccounts',
            'eth_chainId',
        ])
    })

    it.each([
        'eth_signTransaction',
        'eth_sendRawTransaction',
        'eth_sign',
        'wallet_sendCalls',
        'wallet_getCallsStatus',
        'wallet_getCapabilities',
        'wallet_showCallsStatus',
        'wallet_addEthereumChain',
    ])('never lists %s', method => {
        expect(v2.methods).not.toContain(method)
        expect(v2.handleRequest(method, [])).toEqual({ kind: 'unsupported' })
    })

    it('asks the user only for the four signing methods', () => {
        expect(v2.signingMethods).toEqual(v2.methods.slice(0, 4))
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

    it('routes wallet_switchEthereumChain on its first positional param', () => {
        expect(
            v2.handleRequest(ETHEREUM_WC_V2_METHOD.switchChain, [
                { chainId: '0x1' },
            ]),
        ).toEqual({
            kind: 'operation',
            type: 'switch-network',
            params: { chainId: '0x1' },
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

describe('toWireResult', () => {
    it('answers a sent transaction with its hash', () => {
        expect(
            support.toWireResult({ type: 'send-transaction', txId: '0xabc' }),
        ).toBe('0xabc')
    })

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
    ] as const)('maps %s to %i', (failure, code) => {
        expect(support.toWireErrorCode?.(failure)).toBe(code)
    })
})
