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


import { fakeCardAdapter } from '../../__tests__/fakeCardAdapter'
import { CardEscrowNotConfiguredError } from '../../api/escrow/errors'
import { cardContractTests } from '../adapter-contract'

let isStateReadable = true

const adapter = fakeCardAdapter({
    resolveEscrowChainConfig: network => {
        if (network === 'betanet') throw new CardEscrowNotConfiguredError()
        return { assetId: '1', killswitchAppId: '2', mainAppId: '3' }
    },
    autoDraw: {
        isEnabled: async () => {
            if (!isStateReadable) throw new Error('algod unreachable')
            return false
        },
    },
})

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

cardContractTests(() => adapter, {
    network: 'testnet',
    unconfiguredNetwork: 'betanet',
    delegationApproval: {
        address: 'FUNDING',
        currency: 'usdc',
        txId: 'TX1',
        signData,
        signature: 'c2ln',
        token: 'tok',
    },
    delegatorProgram: {
        currency: 'usdc',
        delegatorAddress: 'FUNDING',
        lsigBytes: 'bHNpZw==',
        cardAddress: 'CARD',
    },
    balance: { address: 'FUNDING', assetId: '1', arrangeNoHolding: () => {} },
    autoDraw: {
        params: { network: 'testnet', sender: 'FUNDING', asset: '1' },
        arrangeUnknownState: () => {
            isStateReadable = false
        },
    },
})
