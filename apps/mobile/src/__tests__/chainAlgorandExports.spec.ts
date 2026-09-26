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

// Literal specifiers: the workspace source aliases only rewrite static strings.
const SUBPATHS: Record<string, () => Promise<unknown>> = {
    '@perawallet/wallet-core-chain-algorand': () =>
        import('@perawallet/wallet-core-chain-algorand'),
    '@perawallet/wallet-core-chain-algorand/blockchain': () =>
        import('@perawallet/wallet-core-chain-algorand/blockchain'),
    '@perawallet/wallet-core-chain-algorand/signing': () =>
        import('@perawallet/wallet-core-chain-algorand/signing'),
    '@perawallet/wallet-core-chain-algorand/accounts': () =>
        import('@perawallet/wallet-core-chain-algorand/accounts'),
    '@perawallet/wallet-core-chain-algorand/assets': () =>
        import('@perawallet/wallet-core-chain-algorand/assets'),
    '@perawallet/wallet-core-chain-algorand/transactions': () =>
        import('@perawallet/wallet-core-chain-algorand/transactions'),
    '@perawallet/wallet-core-chain-algorand/swaps': () =>
        import('@perawallet/wallet-core-chain-algorand/swaps'),
    '@perawallet/wallet-core-chain-algorand/asa-inbox': () =>
        import('@perawallet/wallet-core-chain-algorand/asa-inbox'),
    '@perawallet/wallet-core-chain-algorand/nfd': () =>
        import('@perawallet/wallet-core-chain-algorand/nfd'),
    '@perawallet/wallet-core-chain-algorand/fee-delegation': () =>
        import('@perawallet/wallet-core-chain-algorand/fee-delegation'),
    '@perawallet/wallet-core-chain-algorand/multisig': () =>
        import('@perawallet/wallet-core-chain-algorand/multisig'),
    '@perawallet/wallet-core-chain-algorand/card': () =>
        import('@perawallet/wallet-core-chain-algorand/card'),
    '@perawallet/wallet-core-chain-algorand/onramp': () =>
        import('@perawallet/wallet-core-chain-algorand/onramp'),
    '@perawallet/wallet-core-chain-algorand/ledger': () =>
        import('@perawallet/wallet-core-chain-algorand/ledger'),
    '@perawallet/wallet-core-chain-algorand/backup': () =>
        import('@perawallet/wallet-core-chain-algorand/backup'),
    '@perawallet/wallet-core-chain-algorand/connect': () =>
        import('@perawallet/wallet-core-chain-algorand/connect'),
}

describe('chain-algorand subpaths', () => {
    it.each(Object.keys(SUBPATHS))('%s resolves', async specifier => {
        await expect(SUBPATHS[specifier]()).resolves.toBeDefined()
    })
})
