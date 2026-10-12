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

import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { deeplinkAdapterContractTests } from './adapter-contract'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'

deeplinkAdapterContractTests(
    () => fakeDeeplinkAdapter(FIXTURE_CHAIN_ID, ['fixturehex'], fixtureCodec),
    {
        codec: fixtureCodec,
        links: [
            `fixturehex:fx${'a'.repeat(40)}`,
            `fixturehex:tfx${'b'.repeat(40)}?amount=1000000`,
        ],
    },
)
