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

import { describe, it, expect } from 'vitest'
import { toConnectionPermissions } from '../connectionPermissions'

describe('toConnectionPermissions', () => {
    it('maps the EVM signing methods to approve, sign and switch, each once', () => {
        expect(
            toConnectionPermissions([
                'eth_sendTransaction',
                'personal_sign',
                'eth_signTypedData_v4',
                'wallet_switchEthereumChain',
                'wallet_sendCalls',
            ]),
        ).toEqual([
            'view-accounts',
            'approve-transactions',
            'sign-messages',
            'switch-networks',
        ])
    })

    it('maps the Algorand v1 permissions and v2 methods', () => {
        expect(
            toConnectionPermissions([
                'algo_getAccounts',
                'algo_signTxn',
                'algo_signData',
            ]),
        ).toEqual(['view-accounts', 'approve-transactions', 'sign-messages'])
    })

    it('maps the dApp protocol methods the same way', () => {
        expect(
            toConnectionPermissions([
                'requestDataSigning',
                'requestTransactionSigning',
            ]),
        ).toEqual(['view-accounts', 'approve-transactions', 'sign-messages'])
    })

    it('drops methods that grant nothing beyond reading the address', () => {
        expect(
            toConnectionPermissions([
                'eth_chainId',
                'disconnect',
                'algo_getEmptySignatures',
                'something_unknown',
            ]),
        ).toEqual(['view-accounts'])
    })

    it('always lists viewing accounts, even for no methods', () => {
        expect(toConnectionPermissions([])).toEqual(['view-accounts'])
    })
})
