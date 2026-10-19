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
    transactionPlanners,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { SignableGroup } from '../../pipeline/types'
import type { SignerCredential } from './resolveSignerCredential'

/**
 * The planner signs a local key only in the scheme it plans and assembles only
 * a complete signature set, so a key in another scheme (an Algorand quantum
 * key), a multisig cosignature and every other custody stay with the chain's
 * own signer.
 */
export const isPlannerSigned = (
    group: SignableGroup,
    credential: Optional<SignerCredential>,
    chainId: ChainId,
): boolean => {
    if (
        credential?.custody !== 'local' ||
        group.data.type !== 'transactions' ||
        group.shouldUseChainSigner ||
        group.source.type === 'multisig-cosign'
    ) {
        return false
    }
    const planner = transactionPlanners.get(chainId)
    try {
        return group.data.transactions.every(transaction =>
            planner
                .plan(transaction)
                .every(request => request.scheme === credential.scheme),
        )
    } catch {
        return false
    }
}
