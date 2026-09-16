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

import { Networks } from '@perawallet/wallet-core-config'
import { runHandlerContractTests } from '@perawallet/wallet-core-connections/testing'
import { createDappConnectionHandler } from '../handler'
import { FakeDappTransport } from './fake-transport'

const ORIGIN = 'https://contract.example'

// One transport per handler instance: the suite builds handlers repeatedly.
let transport = new FakeDappTransport()

runHandlerContractTests(
    'dapp',
    () => {
        transport = new FakeDappTransport()
        return createDappConnectionHandler({
            transport,
            getNetwork: () => Networks.mainnet,
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
