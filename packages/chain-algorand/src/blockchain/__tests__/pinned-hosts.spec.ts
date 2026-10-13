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

import { describe, expect, it } from 'vitest'
import { config } from '@perawallet/wallet-core-config'
import { algorandPinnedHosts } from '../pinned-hosts'

describe('algorandPinnedHosts', () => {
    it('pins the configured mainnet and testnet node and indexer hosts under the node kill switch', () => {
        expect(algorandPinnedHosts()).toEqual({
            flag: 'enable_ssl_pinning_algod',
            urls: [
                config.mainnetAlgodUrl,
                config.testnetAlgodUrl,
                config.mainnetIndexerUrl,
                config.testnetIndexerUrl,
            ],
            domains: ['algonode.cloud', 'perawallet.app'],
        })
    })
})
