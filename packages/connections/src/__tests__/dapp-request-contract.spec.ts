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

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { DappRequestChainAdapter } from '../dappRequest'
import { dappRequestContractTests } from './dapp-request-contract'

const MAX_TXNS = 2

const fixtureAdapter: DappRequestChainAdapter = {
    chainId: 'algorand',
    relayableErrorNames: ['FixtureError'],
    parseSigningParams: (type, params) => {
        const payload = type === 'sign-transactions' ? params.txns : params.data
        if (payload === undefined) {
            return { ok: false, reason: 'missing', message: 'Missing payload' }
        }
        if (Array.isArray(payload) && payload.length > MAX_TXNS) {
            return { ok: false, reason: 'out-of-bounds', message: 'Too many' }
        }
        return { ok: true, payload }
    },
    resolveReportedNetwork: scope =>
        scope.networkId === 'custom' ? undefined : scope.networkId,
}

dappRequestContractTests(() => fixtureAdapter, {
    overCapTransactionParams: { txns: [1, 2, 3] },
    disclosed: {
        scope: scopeForLegacyNetwork('testnet'),
        reportedAs: 'testnet',
    },
    undisclosed: { scope: scopeForLegacyNetwork('custom') },
})
