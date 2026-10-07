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
    buildAccount,
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    scopeForLegacyNetwork,
    toScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { toAlgorandChainState } from '../../accounts/chain-state'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'

export const buildWatchAccount = (account: LegacyAccount): WalletAccount =>
    buildAccount({
        name: account.name || undefined,
        custody: { kind: 'watch' },
        chainId: ALGORAND_CHAIN_ID,
        chains: { [ALGORAND_CHAIN_ID]: { address: account.address } },
        // Only the mirror — deliberately NOT rekeyAddressByNetwork: rekeys are per-network on-chain
        // and the legacy value's network is ambiguous; the syncer's updateAccountRekeyAddress
        // writes the authoritative per-network map on first tick, per the field's documented contract.
        // The chain-state slice entry is fill-only for the same reason.
        ...(account.authAddress ? { rekeyAddress: account.authAddress } : {}),
    })

/** Active network's scope: the same assumption `applyNetworkRekeyState` makes. */
export const recordLegacyAuthority = (account: LegacyAccount): void => {
    if (!account.authAddress) return
    const scope = scopeForLegacyNetwork(useNetworkStore.getState().network)
    useAccountChainStateStore.getState().fillAccountChainStates({
        [toScopeKey(scope)]: {
            [account.address]: toAlgorandChainState({
                authAddress: account.authAddress,
            }),
        },
    })
}

export const buildLedgerAccount = (account: LegacyAccount): WalletAccount => {
    if (!account.ledger)
        throw new Error('Ledger account missing ledger details')
    return buildAccount({
        name: account.name || undefined,
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                transportType: 'ble',
                deviceId: account.ledger.bluetoothAddress,
                deviceName: account.ledger.bluetoothName ?? '',
            },
            accountIndex: account.ledger.positionInLedger,
        },
        chainId: ALGORAND_CHAIN_ID,
        chains: { [ALGORAND_CHAIN_ID]: { address: account.address } },
    })
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
    return buildAccount({
        name: account.name || undefined,
        custody: { kind: 'multisig' },
        chainId: ALGORAND_CHAIN_ID,
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: account.address,
                native: {
                    family: 'algorand',
                    multisig: {
                        version,
                        threshold: resolvedThreshold,
                        addresses: participants,
                    },
                },
            },
        },
    })
}

const deriveMultisigThreshold = (
    address: string,
    version: number,
    participants: string[],
): number => {
    const multisig = multisigChainAdapters.get(ALGORAND_CHAIN_ID)
    for (let k = 1; k <= participants.length; k += 1) {
        if (
            multisig.deriveAddress({
                version,
                threshold: k,
                addresses: participants,
            }) === address
        )
            return k
    }
    throw new Error(
        `Could not derive multisig threshold for ${address}: no k in [1, ${participants.length}] hashes to the stored address`,
    )
}
