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

import { dappRequestContractTests } from '@perawallet/wallet-core-connections/testing'
import { testChainContext } from '../../__tests__/context'
import { EVM_TEST_CHAINS, evmScopeOf } from '../../__tests__/evm-chains'
import { createEthereumDappRequestAdapter } from '../dappRequestAdapter'

for (const chain of EVM_TEST_CHAINS) {
    const testnet = evmScopeOf(chain, 'testnet')
    dappRequestContractTests(
        () =>
            createEthereumDappRequestAdapter(
                testChainContext({ chain }),
                chain,
            ),
        {
            disclosed: { scope: testnet, reportedAs: testnet.networkId },
            undisclosed: {
                scope: { chainId: chain.row.id, networkId: 'custom' },
            },
            walletConnect: { networkWithCaip2: 'mainnet' },
        },
    )
}
