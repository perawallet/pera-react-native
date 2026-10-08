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

import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import { PERA_URL } from './pera-backend'

export const TEST_RPC_URL = 'https://mainnet.rpc.test/'
export const TEST_PERA_URL = PERA_URL

/**
 * Pera requests go through queryClient, so a spec using this also mocks
 * config with `withEthereumPeraBackend`; `services` is what the chain code
 * checks before calling. An empty list empties the base URL, as the app does.
 */
export const testChainContext = ({
    services = [],
}: { services?: readonly string[] } = {}): ChainContext => ({
    getScope: () => ({ chainId: 'ethereum', networkId: 'mainnet' }),
    getEndpoints: () => ({ mainnet: TEST_RPC_URL }),
    getPeraBackend: () => ({
        baseUrl: services.length > 0 ? TEST_PERA_URL : '',
        services: new Set(services),
    }),
    timeouts: { readMs: 1_000, submitMs: 1_000 },
    kms: {} as ChainContext['kms'],
})
