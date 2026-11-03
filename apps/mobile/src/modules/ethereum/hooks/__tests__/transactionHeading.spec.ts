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

import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type {
    EthereumTransactionView,
    EvmContractAction,
} from '@perawallet/wallet-core-chain-ethereum'
import { counterpartyOf, iconNameOf, titleKeyOf } from '../transactionHeading'
import type { EthereumContractActionPresentation } from '../useEthereumContractAction'
import type { EthereumStandardCallPresentation } from '../useEthereumStandardCall'

const SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const ROUTER = '0x23617e59A5925b2A4Bf75d73ff6711cD0b29De85'
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const view = (
    overrides: Partial<EthereumTransactionView> = {},
): EthereumTransactionView =>
    ({
        kind: 'contract-call',
        from: SIGNER,
        to: ROUTER,
        value: new Decimal(0),
        data: '0x',
        isPreview: true,
        ...overrides,
    }) as EthereumTransactionView

const amount = { asset: null, value: new Decimal(1), isBaseUnits: true }

const swapAction: EvmContractAction = {
    kind: 'swap',
    input: {
        asset: { kind: 'native' },
        amount: new Decimal(1),
        bound: 'exact',
    },
    output: {
        asset: { kind: 'native' },
        amount: new Decimal(1),
        bound: 'at-least',
    },
    fees: [],
}

const swap: EthereumContractActionPresentation = {
    kind: 'swap',
    input: { ...amount, bound: 'exact' },
    output: { ...amount, bound: 'at-least' },
    fees: [],
}

const wrap: EthereumContractActionPresentation = { kind: 'wrap', amount }

const approval = (spendApproval?: object): EthereumStandardCallPresentation =>
    ({
        kind: 'token-approval',
        contract: TOKEN,
        spender: SIGNER,
        spendApproval,
    }) as EthereumStandardCallPresentation

const tokenTransfer: EthereumStandardCallPresentation = {
    kind: 'token-transfer',
    contract: TOKEN,
    from: SIGNER,
    to: ROUTER,
    amount,
}

describe('titleKeyOf', () => {
    it('titles an approval, and a revocation, from the standard call', () => {
        expect(titleKeyOf(view(), approval({}), null)).toBe(
            'transactions.list_item.approval',
        )
        expect(titleKeyOf(view(), approval(), null)).toBe(
            'transactions.list_item.revoke_approval',
        )
    })

    it('titles a call from its contract action', () => {
        expect(titleKeyOf(view({ action: swapAction }), null, swap)).toBe(
            'transactions.list_item.swap',
        )
        expect(
            titleKeyOf(
                view({ action: { kind: 'wrap', amount: new Decimal(1) } }),
                null,
                wrap,
            ),
        ).toBe('transactions.list_item.wrap')
    })

    it('lets an approval win over an action', () => {
        expect(
            titleKeyOf(view({ action: swapAction }), approval({}), swap),
        ).toBe('transactions.list_item.approval')
    })

    it('lets a read transfer win over an action', () => {
        expect(
            titleKeyOf(view({ action: swapAction }), tokenTransfer, swap),
        ).toBe('transactions.list_item.send')
    })

    it('keeps an unread contract call a contract call and a transfer a send', () => {
        expect(titleKeyOf(view(), null, null)).toBe(
            'transactions.list_item.contract_call',
        )
        expect(titleKeyOf(view({ kind: 'transfer' }), null, null)).toBe(
            'transactions.list_item.send',
        )
    })
})

describe('iconNameOf', () => {
    it('uses the swap icon for a swap and the contract call icon for another action', () => {
        expect(iconNameOf(view(), null, swap)).toBe('transactions/swap')
        expect(iconNameOf(view(), null, wrap)).toBe(
            'transactions/application-call',
        )
    })

    it('uses the approval icon for an approval, even with an action', () => {
        expect(iconNameOf(view(), approval({}), swap)).toBe(
            'transactions/application-call',
        )
    })

    it('uses the send icon for a read transfer and a transfer', () => {
        expect(iconNameOf(view(), tokenTransfer, swap)).toBe(
            'transactions/send',
        )
        expect(iconNameOf(view({ kind: 'transfer' }), null, null)).toBe(
            'transactions/send',
        )
    })

    it('uses the contract call icon for an unread call', () => {
        expect(iconNameOf(view(), null, null)).toBe(
            'transactions/application-call',
        )
    })
})

describe('counterpartyOf', () => {
    it('is the recipient of a transfer', () => {
        expect(counterpartyOf(tokenTransfer)).toBe(ROUTER)
    })

    it('is the spender of an approval and the operator of a collection approval', () => {
        expect(counterpartyOf(approval({}))).toBe(SIGNER)
        expect(
            counterpartyOf({
                kind: 'collection-approval',
                contract: TOKEN,
                operator: ROUTER,
                isApproved: true,
            }),
        ).toBe(ROUTER)
    })
})
