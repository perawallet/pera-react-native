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


import { getNetworkConfig } from '@perawallet/wallet-core-config'
import { dappRequestContractTests } from '@perawallet/wallet-core-connections/testing'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing/constants'
import { algorandDappRequestAdapter } from '../dappRequestAdapter'

dappRequestContractTests(() => algorandDappRequestAdapter, {
    overCapTransactionParams: {
        txns: Array.from({ length: MAX_TRANSACTION_SIGN_REQUESTS + 1 }, () => ({
            txn: 'AA==',
        })),
    },
    disclosed: {
        network: 'custom',
        customGenesisHash: getNetworkConfig('mainnet').genesisHash,
        reportedAs: 'mainnet',
    },
    undisclosed: { network: 'custom' },
})
