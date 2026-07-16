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
import type { AnalyzedSignableGroup } from '../../pipeline/types'
import { resolveSigningAccount } from './resolveSigningAccount'

/**
 * Resolves the human-readable device name for the account that will actually
 * sign the first group, so the hardware overlay can display it immediately.
 *
 * The signature comes from the account {@link resolveSigningAccount} picks —
 * the AUTH account for rekeyed transaction senders (rekeyed-to-Ledger,
 * undo-rekey), the participant itself for multisig cosign and off-chain data
 * — so the device name must be read from the same account, not the raw
 * sender. Returns null when no name can be resolved (unknown signer, broken
 * rekey chain); the overlay then falls back to generic copy.
 */
export const resolveHardwareDeviceName = (
    groups: AnalyzedSignableGroup[],
    allAccounts: WalletAccount[],
): string | null => {
    const firstGroup = groups[0]
    if (!firstGroup) return null
    const signerAccount = allAccounts.find(
        a => a.address === firstGroup.signerAddress,
    )
    if (!signerAccount) return null

    let accountForSigning: WalletAccount
    try {
        accountForSigning = resolveSigningAccount(
            signerAccount,
            firstGroup.source,
            firstGroup.data.type,
            allAccounts,
        )
    } catch {
        // Rekey target not held — the sign itself will fail with a typed
        // error; the overlay just shows generic copy.
        return null
    }

    return (
        (accountForSigning as { hardwareDetails?: { deviceName?: string } })
            .hardwareDetails?.deviceName ?? null
    )
}
