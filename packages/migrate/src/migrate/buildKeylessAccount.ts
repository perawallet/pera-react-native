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
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'

export const buildWatchAccount = (account: LegacyAccount): WalletAccount => ({
    id: generateOrderedUniqueId(),
    name: account.name || undefined,
    type: AccountTypes.watch,
    address: account.address,
    // Only the mirror — deliberately NOT rekeyAddressByNetwork: rekeys are per-network on-chain
    // and the legacy value's network is ambiguous; the syncer's updateAccountRekeyAddress
    // writes the authoritative per-network map on first tick, per the field's documented contract.
    ...(account.authAddress ? { rekeyAddress: account.authAddress } : {}),
})

export const buildLedgerAccount = (account: LegacyAccount): WalletAccount => {
    if (!account.ledger)
        throw new Error('Ledger account missing ledger details')
    return {
        id: generateOrderedUniqueId(),
        name: account.name || undefined,
        type: AccountTypes.hardware,
        address: account.address,
        hardwareDetails: {
            manufacturer: 'ledger',
            transportType: 'ble',
            deviceId: account.ledger.bluetoothAddress,
            deviceName: account.ledger.bluetoothName ?? '',
            accountIndex: account.ledger.positionInLedger,
        },
    }
}

export const buildMultiSigAccount = (account: LegacyAccount): WalletAccount => {
    if (!account.joint)
        throw new Error('Multisig account missing joint details')
    const { participants, version, threshold } = account.joint
    if (participants.length === 0)
        throw new Error(
            `Multisig account ${account.address} has no participants`,
        )
    const resolvedThreshold =
        threshold ??
        deriveMultisigThreshold(account.address, version, participants)
    return {
        id: generateOrderedUniqueId(),
        name: account.name || undefined,
        type: AccountTypes.multisig,
        address: account.address,
        multisigDetails: {
            threshold: resolvedThreshold,
            addresses: participants,
            version: version,
        },
    }
}

const deriveMultisigThreshold = (
    address: string,
    version: number,
    participants: string[],
): number => {
    for (let k = 1; k <= participants.length; k += 1) {
        if (generateMultisigAddress(version, k, participants) === address)
            return k
    }
    throw new Error(
        `Could not derive multisig threshold for ${address}: no k in [1, ${participants.length}] hashes to the stored address`,
    )
}
