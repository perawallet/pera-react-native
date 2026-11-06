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

import { vi } from 'vitest'
import { rampContractTests } from '@perawallet/wallet-core-onramp/testing'
import { algorandRampAdapter } from '../adapter'

// The opt-in hook pulls the React signing stack; the suite never calls it.
vi.mock('../useEnsureDestinationOptIn', () => ({
    useEnsureDestinationOptIn: vi.fn(),
}))

const MAINNET_CAIP2 = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'

rampContractTests(() => algorandRampAdapter, {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    native: { routerAssetId: `${MAINNET_CAIP2}/asa:0`, assetId: '0' },
    nonNative: {
        routerAssetId: `${MAINNET_CAIP2}/asa:31566704`,
        assetId: '31566704',
    },
    foreignRouterAssetId: 'eip155:1/slip44:60',
    malformedRouterAssetIds: [
        '',
        MAINNET_CAIP2,
        `${MAINNET_CAIP2}/asa:`,
        `${MAINNET_CAIP2}/asa:01`,
        `${MAINNET_CAIP2}/slip44:283`,
    ],
})
