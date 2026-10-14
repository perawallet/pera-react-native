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

import { getProvider } from '@perawallet/wallet-extension-provider'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { deeplinkAdapters } from './chain-adapter'
import type { ChainDeeplinkIntent, ChainDeeplinkResolution } from './models'

export const resolveChainDeeplink = (
    input: string,
): ChainDeeplinkResolution => {
    // Pasted text carries stray whitespace and newlines.
    const text = input.trim()
    if (text === '') return { status: 'unrecognised' }

    const { chains } = getProvider()

    const owner = deeplinkAdapters.list().find(a => a.canParse(text))
    if (owner) {
        if (chains.isSwitchedOff(owner.chainId)) {
            return {
                status: 'failed',
                chainId: owner.chainId,
                reason: 'chain-unavailable',
            }
        }
        const result = owner.parse(text)
        return result.ok
            ? { status: 'resolved', intents: [result.intent] }
            : {
                  status: 'failed',
                  chainId: owner.chainId,
                  reason: result.reason,
              }
    }

    // A chain is never guessed from an address's shape: every codec that
    // accepts the text is a candidate and the caller decides between them.
    const candidates = addressCodecs.list().filter(c => c.isValid(text))
    const intents: ChainDeeplinkIntent[] = candidates
        .filter(c => !chains.isSwitchedOff(c.chainId))
        .map(c => ({
            kind: 'address',
            target: { chainId: c.chainId },
            address: text,
        }))

    const [first, ...rest] = intents
    if (first) return { status: 'resolved', intents: [first, ...rest] }
    if (candidates.length > 0) {
        return {
            status: 'failed',
            chainId: candidates[0].chainId,
            reason: 'chain-unavailable',
        }
    }
    return { status: 'unrecognised' }
}
