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

rampContractTests(() => algorandRampAdapter, {
    native: { id: 'ALGO', symbol: 'ALGO' },
    nonNative: {
        token: { id: '31566704', symbol: 'USDC' },
        assetId: '31566704',
    },
})
