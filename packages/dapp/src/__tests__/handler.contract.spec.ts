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

import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { runHandlerContractTests } from '@perawallet/wallet-core-connections/testing'
import { createDappConnectionHandler } from '../handler'
import { FakeDappTransport } from './fake-transport'

const ORIGIN = 'https://contract.example'

dappRequestChainAdapters.register({
    chainId: 'algorand',
    relayableErrorNames: [],
    parseSigningParams: (_type, params) => ({ ok: true, payload: params.txns }),
    resolveReportedNetwork: scope => scope.networkId,
    walletConnect: {
        namespace: 'algorand',
        caip2ChainIdFor: () => null,
        networkForCaip2ChainId: () => null,
        toWireResult: () => null,
        emptySignaturesFor: () => ({}),
    },
    validateTransactionPayload: payload =>
        Array.isArray(payload) && payload.length > 0
            ? { ok: true, group: payload }
            : { ok: false, message: 'Invalid algo_signTxn payload' },
    useEnqueueTransactionSigning: () => async () => null,
})

// One transport per handler instance: the suite builds handlers repeatedly.
let transport = new FakeDappTransport()

runHandlerContractTests(
    'dapp',
    () => {
        transport = new FakeDappTransport()
        return createDappConnectionHandler({
            transport,
            chainId: 'algorand',
            getNetwork: () => 'mainnet',
            getCustomNetworkGenesisHash: () => undefined,
            getAccounts: () => [{ address: 'AAAA', name: 'A' }],
        })
    },
    {
        accounts: ['AAAA'],
        peer: {
            propose: () => {
                void transport.send(ORIGIN, 'connect', {
                    name: 'Contract dApp',
                })
            },
            request: connectionId => {
                void transport.send(connectionId, 'requestTransactionSigning', {
                    txns: [{ txn: 'AA==' }],
                })
            },
            setReachable: (connectionId, isReachable) => {
                transport.setReachable(connectionId, isReachable)
            },
        },
    },
)
