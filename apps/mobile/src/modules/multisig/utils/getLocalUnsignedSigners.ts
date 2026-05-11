/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    hasSigningKeys,
    isHardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'

/**
 * Returns the local-key participants of a multisig sign request that have not
 * yet responded (signed or declined).
 *
 * Multisig participant slots are validated on chain against the participant's
 * original pubkey at the time the multisig was created — rekeying a
 * participant address has no effect on its multisig slot. So the participant
 * must hold its OWN local signing keys here; the auth account / rekey target
 * is irrelevant. (Contrast: a regular tx with sender = rekeyed account is
 * signed by the rekey target's key.)
 *
 * TODO: Hardware-wallet participants are excluded from this PR — Ledger
 * cosigning is deferred.
 *
 * "Responded" means the participant has an entry in
 * `transactionLists[0].responses` with `response: 'signed' | 'declined'`.
 * No entry means the participant is still pending.
 *
 * Non-hardware participants are returned before hardware ones; within each
 * tier, the backend's `participantAddresses` order is preserved (stable
 * sort). The sort is a no-op while the hardware filter above is in place,
 * but kicks in once Ledger cosigning is enabled — instant local-key signers
 * dispatch first, device-prompt Ledger signers last.
 */
export const getLocalUnsignedSigners = (
    signRequest: MultisigSignRequest,
    allAccounts: WalletAccount[],
): WalletAccount[] => {
    const transactionList = signRequest.transactionLists[0]
    if (!transactionList) return []

    const respondedAddresses = new Set(
        transactionList.responses.map(r => r.address),
    )

    const result: WalletAccount[] = []

    for (const participantAddress of signRequest.multisigAccount
        .participantAddresses) {
        if (respondedAddresses.has(participantAddress)) continue

        const account = allAccounts.find(a => a.address === participantAddress)
        if (!account) continue
        if (!hasSigningKeys(account)) continue
        if (isHardwareWalletAccount(account)) continue

        result.push(account)
    }

    result.sort(
        (a, b) =>
            Number(isHardwareWalletAccount(a)) -
            Number(isHardwareWalletAccount(b)),
    )

    return result
}
