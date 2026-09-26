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

import { assertType, describe, expectTypeOf, it } from 'vitest'
import type { ChainCapabilities, ChainCapability } from '../capabilities'

describe('ChainCapability', () => {
    it('is exactly the declared capability keys', () => {
        expectTypeOf<ChainCapability>().toEqualTypeOf<
            | 'send'
            | 'receive'
            | 'history'
            | 'assets'
            | 'pricing'
            | 'messageSigning'
            | 'dappConnect'
            | 'customNetworks'
            | 'watchAccounts'
            | 'ledger'
            | 'multisig'
            | 'rekey'
            | 'quantumAccounts'
            | 'staking'
            | 'swap'
            | 'card'
            | 'assetInbox'
            | 'nameService'
            | 'onramp'
            | 'giftCards'
            | 'discover'
            | 'feeDelegation'
            | 'arc0027'
            | 'liquidAuth'
            | 'notifications'
            | 'cloudBackup'
            | 'mnemonicBackup'
            | 'secureBackup'
            | 'nft'
            | 'manageAssets'
            | 'privateKeys'
            | 'contractDecoding'
        >()
    })
})

describe('ChainCapabilities', () => {
    it('rejects a map that is missing a key', () => {
        // @ts-expect-error every capability must be declared
        assertType<ChainCapabilities>({ send: true, receive: true })
    })
})
