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

import type { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    generateOrderedUniqueId,
    type Network,
} from '@perawallet/wallet-core-shared'
import {
    AccountTypes,
    type AccountCredential,
    type Algo25Account,
    type HardwareWalletAccount,
    type HDWalletAccount,
    type LocalCredential,
    type MultiSigAccount,
    type QuantumAccount,
    type WalletAccount,
    type WatchAccount,
} from '../models'

export type BuildAccountInput<C extends AccountCredential = AccountCredential> =
    {
        /** Defaults to a fresh ordered unique id. */
        id?: string
        name?: string
        address: string
        credential: C
        rekeyAddress?: string
        rekeyAddressByNetwork?: Partial<Record<Network, string>>
    }

/** The legacy account variant a credential maps onto. */
export type AccountForCredential<C extends AccountCredential> = C extends {
    kind: 'hardware'
}
    ? HardwareWalletAccount
    : C extends { kind: 'multisig' }
      ? MultiSigAccount
      : C extends { kind: 'watch' }
        ? WatchAccount
        : C extends { provenance: typeof SeedScheme.Bip39 }
          ? HDWalletAccount
          : C extends { provenance: typeof SeedScheme.Quantum }
            ? QuantumAccount
            : C extends { provenance: typeof SeedScheme.Algo25 }
              ? Algo25Account
              : WalletAccount

type LegacyFields =
    | Pick<Algo25Account, 'type' | 'keyPairId'>
    | Pick<QuantumAccount, 'type' | 'keyPairId'>
    | Pick<HDWalletAccount, 'type' | 'keyPairId' | 'hdWalletDetails'>
    | Pick<HardwareWalletAccount, 'type' | 'hardwareDetails'>
    | Pick<MultiSigAccount, 'type' | 'multisigDetails'>
    | Pick<WatchAccount, 'type'>

const localLegacyFieldsOf = (credential: LocalCredential): LegacyFields => {
    if (credential.provenance === 'bip39') {
        return {
            type: AccountTypes.hdWallet,
            keyPairId: credential.keyPairId,
            hdWalletDetails: { ...credential.hd },
        }
    }
    return {
        type:
            credential.provenance === 'quantum'
                ? AccountTypes.quantum
                : AccountTypes.algo25,
        keyPairId: credential.keyPairId,
    }
}

const legacyFieldsOf = (credential: AccountCredential): LegacyFields => {
    switch (credential.kind) {
        case 'local': {
            return localLegacyFieldsOf(credential)
        }
        case 'hardware': {
            return {
                type: AccountTypes.hardware,
                hardwareDetails: {
                    ...credential.device,
                    accountIndex: credential.accountIndex,
                },
            }
        }
        case 'multisig': {
            return {
                type: AccountTypes.multisig,
                multisigDetails: {
                    threshold: credential.threshold,
                    addresses: [...credential.members],
                    version: credential.version,
                },
            }
        }
        case 'watch': {
            return { type: AccountTypes.watch }
        }
    }
}

/**
 * The one way to construct a {@link WalletAccount}: the legacy `type` and
 * details object are derived from the credential, so the two can't disagree.
 */
export const buildAccount = <C extends AccountCredential>({
    id,
    name,
    address,
    credential,
    rekeyAddress,
    rekeyAddressByNetwork,
}: BuildAccountInput<C>): AccountForCredential<C> =>
    ({
        id: id ?? generateOrderedUniqueId(),
        ...(name !== undefined ? { name } : {}),
        address,
        ...legacyFieldsOf(credential),
        ...(rekeyAddress !== undefined ? { rekeyAddress } : {}),
        ...(rekeyAddressByNetwork !== undefined
            ? { rekeyAddressByNetwork }
            : {}),
        credentials: [credential],
    }) as AccountForCredential<C>
