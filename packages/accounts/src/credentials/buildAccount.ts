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

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import type { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    generateOrderedUniqueId,
    type Network,
} from '@perawallet/wallet-core-shared'
import { AccountError } from '../errors'
import {
    AccountTypes,
    type AccountCredentials,
    type AccountProvenance,
    type Algo25Account,
    type ChainCredential,
    type HardwareWalletAccount,
    type HDWalletAccount,
    type LocalProvenance,
    type MultiSigAccount,
    type QuantumAccount,
    type WalletAccount,
    type WatchAccount,
} from '../models'

// The legacy `keyPairId` is the Algorand key, so a local account must have one.
type LocalCredentials = AccountCredentials &
    Record<typeof LEGACY_CHAIN_ID, ChainCredential>

export type BuildAccountInput<P extends AccountProvenance = AccountProvenance> =
    {
        /** Defaults to a fresh ordered unique id. */
        id?: string
        name?: string
        address: string
        provenance: P
        rekeyAddress?: string
        rekeyAddressByNetwork?: Partial<Record<Network, string>>
    } & (P extends { kind: 'local' }
        ? { credentials: LocalCredentials }
        : { credentials?: AccountCredentials })

/** The legacy account variant a provenance maps onto. */
export type AccountForProvenance<P extends AccountProvenance> = P extends {
    kind: 'hardware'
}
    ? HardwareWalletAccount
    : P extends { kind: 'multisig' }
      ? MultiSigAccount
      : P extends { kind: 'watch' }
        ? WatchAccount
        : P extends { seed: typeof SeedScheme.Bip39 }
          ? HDWalletAccount
          : P extends { seed: typeof SeedScheme.Quantum }
            ? QuantumAccount
            : P extends { seed: typeof SeedScheme.Algo25 }
              ? Algo25Account
              : WalletAccount

type LegacyFields =
    | Pick<Algo25Account, 'type' | 'keyPairId'>
    | Pick<QuantumAccount, 'type' | 'keyPairId'>
    | Pick<HDWalletAccount, 'type' | 'keyPairId' | 'hdWalletDetails'>
    | Pick<HardwareWalletAccount, 'type' | 'hardwareDetails'>
    | Pick<MultiSigAccount, 'type' | 'multisigDetails'>
    | Pick<WatchAccount, 'type'>

const localLegacyFieldsOf = (
    provenance: LocalProvenance,
    credentials: AccountCredentials,
): LegacyFields => {
    const keyPairId = credentials[LEGACY_CHAIN_ID]?.keyPairId
    if (!keyPairId) {
        throw new AccountError(
            'A local account needs a credential on the Algorand chain',
        )
    }
    if (provenance.seed === 'bip39') {
        return {
            type: AccountTypes.hdWallet,
            keyPairId,
            hdWalletDetails: { ...provenance.hd },
        }
    }
    return {
        type:
            provenance.seed === 'quantum'
                ? AccountTypes.quantum
                : AccountTypes.algo25,
        keyPairId,
    }
}

const legacyFieldsOf = (
    provenance: AccountProvenance,
    credentials: AccountCredentials,
): LegacyFields => {
    switch (provenance.kind) {
        case 'local': {
            return localLegacyFieldsOf(provenance, credentials)
        }
        case 'hardware': {
            return {
                type: AccountTypes.hardware,
                hardwareDetails: {
                    ...provenance.device,
                    accountIndex: provenance.accountIndex,
                },
            }
        }
        case 'multisig': {
            return {
                type: AccountTypes.multisig,
                multisigDetails: {
                    threshold: provenance.threshold,
                    addresses: [...provenance.members],
                    version: provenance.version,
                },
            }
        }
        case 'watch': {
            return { type: AccountTypes.watch }
        }
    }
}

/**
 * Builds a {@link WalletAccount} from its provenance and credentials. The
 * legacy `type` and details object are derived from them, so they can't
 * disagree.
 */
export const buildAccount = <P extends AccountProvenance>(
    input: BuildAccountInput<P>,
): AccountForProvenance<P> => {
    const {
        id,
        name,
        address,
        provenance,
        rekeyAddress,
        rekeyAddressByNetwork,
    } = input
    const credentials: AccountCredentials = input.credentials ?? {}
    return {
        id: id ?? generateOrderedUniqueId(),
        ...(name !== undefined ? { name } : {}),
        chainId: LEGACY_CHAIN_ID,
        address,
        ...legacyFieldsOf(provenance, credentials),
        ...(rekeyAddress !== undefined ? { rekeyAddress } : {}),
        ...(rekeyAddressByNetwork !== undefined
            ? { rekeyAddressByNetwork }
            : {}),
        provenance,
        credentials,
    } as AccountForProvenance<P>
}
