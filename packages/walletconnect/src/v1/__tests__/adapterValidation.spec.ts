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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Networks } from '@perawallet/wallet-core-shared'
import { dappRequestAdapterFor } from '../../shared/chainSupport'
import {
    gateSignDataRequest,
    gateSignTxnRequest,
} from '../../validation/inboundRequestGate'
import { AlgorandWalletConnectChainId } from '../../models'

// The real adapter this package's setup file registers, not a fixture: v1's
// inbound gate must screen through the same chain adapter v2 routes through.
const screenRequestOfRegisteredAdapter = () => {
    const v1 = dappRequestAdapterFor(Networks.mainnet)?.walletConnect.v1
    if (!v1) throw new Error('the registered adapter serves no v1')
    return vi.spyOn(v1, 'screenRequest')
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('v1 inbound requests screened by the registered chain adapter', () => {
    it('hands a transaction request its first positional slot', () => {
        const screenRequest = screenRequestOfRegisteredAdapter()

        gateSignTxnRequest({
            payload: { id: 1, params: [[{ txn: 'AA==' }]] },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.all,
            knownAddresses: [],
        })

        expect(screenRequest).toHaveBeenCalledWith(
            'sign-transactions',
            [{ txn: 'AA==' }],
            [],
        )
    })

    it('hands a data request its params object', () => {
        const screenRequest = screenRequestOfRegisteredAdapter()
        const params = { data: 'AA==', signer: 'A'.repeat(58) }

        gateSignDataRequest({
            payload: { id: 1, params },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.all,
        })

        expect(screenRequest).toHaveBeenCalledWith('sign-data', params, [])
    })

    it("rejects with the adapter's own refusal reason", () => {
        screenRequestOfRegisteredAdapter().mockReturnValue({
            ok: false,
            reason: 'fixture refusal',
        })

        const result = gateSignTxnRequest({
            payload: { id: 1, params: [[{ txn: 'AA==' }]] },
            network: Networks.mainnet,
            sessionChainId: AlgorandWalletConnectChainId.all,
            knownAddresses: [],
        })

        expect(result).toMatchObject({ reason: 'fixture refusal' })
    })
})
