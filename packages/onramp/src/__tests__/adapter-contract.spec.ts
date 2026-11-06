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

import { fakeRampAdapter } from './fakeRampAdapter'
import { rampContractTests } from './adapter-contract'

rampContractTests(() => fakeRampAdapter(), {
    scope: { chainId: 'algorand', networkId: 'mainnet' },
    native: { routerAssetId: 'fake:a/asset:0', assetId: '0' },
    nonNative: { routerAssetId: 'fake:a/asset:31566704', assetId: '31566704' },
    foreignRouterAssetId: 'fake:b/token:31566704',
    malformedRouterAssetIds: ['', 'fake:a', 'fake:a/asset:'],
})
