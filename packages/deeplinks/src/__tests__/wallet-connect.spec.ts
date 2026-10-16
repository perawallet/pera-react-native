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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    deeplinkAdapters,
    uriSchemeOf,
    type DeeplinkChainAdapter,
} from '../chain-adapter'
import { walletConnectUriOf } from '../wallet-connect'

const CHAIN = 'fixturehex' as ChainId

// Unwraps `wrapper:` to `wc:` the way a chain's adapter does.
const wrapperAdapter: DeeplinkChainAdapter = {
    chainId: CHAIN,
    schemes: ['wrapper'],
    canParse: input => uriSchemeOf(input) === 'wrapper',
    parse: input => ({
        ok: true,
        intent: {
            kind: 'wallet-connect',
            uri: `wc:${input.slice(input.indexOf(':') + 1)}`,
        },
    }),
    toAssetRef: () => undefined,
}

describe('walletConnectUriOf', () => {
    beforeEach(() => {
        deeplinkAdapters.register(wrapperAdapter)
    })

    afterEach(() => {
        deeplinkAdapters.reset()
    })

    it('returns a wc: link as given', () => {
        expect(walletConnectUriOf('wc:topic@2?symKey=k')).toBe(
            'wc:topic@2?symKey=k',
        )
    })

    it('returns the URI an adapter unwraps a chain wrapper to', () => {
        expect(walletConnectUriOf('wrapper:topic@1?key=k')).toBe(
            'wc:topic@1?key=k',
        )
    })

    it('is undefined for a link that is not WalletConnect', () => {
        expect(walletConnectUriOf('perawallet://app/home')).toBeUndefined()
        expect(walletConnectUriOf('hello')).toBeUndefined()
    })
})
