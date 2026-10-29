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

import type { DappRequestFailure } from '@perawallet/wallet-core-connections'
import {
    CannotSignError,
    type MessageSignerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { EvmChain } from '../chains/types'

// Read per call, not at registration, so remote config and Feature Flags reach sessions already approved.
export const isMessageSigningEnabled = (chain: EvmChain): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(chain.row.id) &&
        chains.capabilities(chain.row.id).messageSigning
    )
}

export class MessageSigningOffError extends CannotSignError {
    // Read structurally by every dApp transport, so a request refused at sign time still answers 4200.
    readonly failure: DappRequestFailure = 'unsupported-method'

    constructor(signer: string, chain: EvmChain) {
        super(signer, `message signing is off on ${chain.row.displayName}`)
        this.name = 'MessageSigningOffError'
    }
}

/**
 * Refuses every plan while `messageSigning` is off. Routing refuses new
 * requests; this catches one routed before the switch and still queued or in
 * review, since every signing path (local key, device) plans first.
 */
export const withMessageSigningGate = (
    chain: EvmChain,
    adapter: MessageSignerChainAdapter,
): MessageSignerChainAdapter => ({
    ...adapter,
    plan: (request, context) => {
        if (!isMessageSigningEnabled(chain)) {
            throw new MessageSigningOffError(request.signer, chain)
        }
        return adapter.plan(request, context)
    },
})
