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
    hasSigningKeys,
    isHardwareWalletAccount,
    isQuantumAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigSignRequest } from '@perawallet/wallet-core-multisig'

/**
 * Returns the local-signable participants of a multisig sign request that
 * have not yet responded (signed or declined). Includes both local-key
 * (Algo25, HD) and hardware-wallet (Ledger) participants.
 *
 * Multisig participant slots are validated on chain against the participant's
 * original pubkey at the time the multisig was created — rekeying a
 * participant address has no effect on its multisig slot. So the participant
 * must hold its OWN local signing keys here; the auth account / rekey target
 * is irrelevant. (Contrast: a regular tx with sender = rekeyed account is
 * signed by the rekey target's key.)
 *
 * "Responded" means the participant has an entry in
 * `transactionLists[0].responses` with `response: 'signed' | 'declined'`.
 * No entry means the participant is still pending.
 *
 * Non-hardware participants are returned before hardware ones; within each
 * tier, the backend's `participantAddresses` order is preserved (stable
 * sort). Callers that batch-dispatch (the footer Sign button) sign instant
 * local-key signers first; per-row dispatches for Ledger happen one device
 * prompt at a time.
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
        if (!hasSigningKeys(account) && !isHardwareWalletAccount(account))
            continue
        // Quantum participants carry their own keyPairId (hasSigningKeys is
        // true), but multisig slots verify Ed25519 signatures only, and
        // algosdk's own PQ signer rejects multisig signing outright — so a
        // quantum participant can never contribute a usable subsignature.
        // Mirrors packages/signing/src/pipeline/signing/utils.ts's
        // getLocalParticipants; keep both in agreement rather than admitting
        // quantum here instead.
        if (isQuantumAccount(account)) continue

        result.push(account)
    }

    result.sort(
        (a, b) =>
            Number(isHardwareWalletAccount(a)) -
            Number(isHardwareWalletAccount(b)),
    )

    return result
}
