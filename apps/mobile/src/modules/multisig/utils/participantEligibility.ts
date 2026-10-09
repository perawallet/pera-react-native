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
    canSignDirectly,
    hasCustody,
    localKeyKindOf,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'

/** False for a local key minted under a scheme the chain's participant slots can't verify. */
export const signsWithParticipantScheme = (
    account: WalletAccount,
    chainId: ChainId,
): boolean => {
    if (!hasCustody(account, 'local')) return true
    const scheme = localKeyKindOf(chainId, account.custody.seed)?.signingScheme
    return (
        scheme !== undefined &&
        multisigChainAdapters.get(chainId).acceptsParticipantScheme(scheme)
    )
}

/** Whether a held account may be offered as a participant of a new multisig. */
export const canBeMultisigParticipant = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    (hasCustody(account, 'local') || hasCustody(account, 'hardware')) &&
    signsWithParticipantScheme(account, chainId)

/**
 * Whether the account can contribute its OWN subsignature: a multisig slot is
 * bound to the participant's original key, so rekeying is irrelevant here.
 */
export const canSignAsParticipant = (
    account: WalletAccount,
    chainId: ChainId,
): boolean =>
    canSignDirectly(account) && signsWithParticipantScheme(account, chainId)
