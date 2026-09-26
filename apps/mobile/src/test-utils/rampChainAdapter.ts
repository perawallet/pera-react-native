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

import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
// The adapter file rather than the chain-algorand onramp barrel: the barrel
// also carries the opt-in hook, which pulls in fee delegation and signing.
import { algorandRampAdapter } from '@packages/chain-algorand/src/onramp/adapter'

// Unit specs skip the app bootstrap, so the real ramp token helpers have no
// adapter unless a spec registers one.
export const registerAlgorandRampAdapter = (): void => {
    rampChainAdapters.reset()
    rampChainAdapters.register(algorandRampAdapter)
}
