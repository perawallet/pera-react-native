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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

type SelectCosignDispatchAddressesParams = {
    /** Local-key (Algo25/HD) unsigned participants, in dispatch order. */
    localKeySigners: WalletAccount[]
    /** Participant addresses already mid-cosign in the signing queue. */
    inFlightAddresses: Set<string>
    /** The multisig signing threshold. */
    threshold: number
    /** Participants already recorded as `signed` by the backend. */
    signedCount: number
}

/**
 * Decides which local-key participants a batch Sign should cosign for, so the
 * footer Sign button and the inbox-tap shortcut never over-dispatch.
 *
 * Two rules, both enforced here rather than at the call sites:
 * - Skip anyone already in flight — a fresh dispatch of the same signer mints a
 *   new queue id (see `buildMultisigCosignRequest`), so without this a repeated
 *   Sign stacks duplicate review sheets that then linger.
 * - Cap the batch at the signatures still needed: `threshold - signedCount`,
 *   minus those already in flight (each becomes a signature). Beyond that the
 *   multisig is satisfied, so surplus local participants must not be dispatched.
 *
 * Order is preserved from `localKeySigners` (backend participant order).
 */
export const selectCosignDispatchAddresses = ({
    localKeySigners,
    inFlightAddresses,
    threshold,
    signedCount,
}: SelectCosignDispatchAddressesParams): string[] => {
    const slots = threshold - signedCount - inFlightAddresses.size
    if (slots <= 0) return []

    const result: string[] = []
    for (const account of localKeySigners) {
        if (result.length >= slots) break
        if (inFlightAddresses.has(account.address)) continue
        result.push(account.address)
    }
    return result
}
