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
    LEGACY_CHAIN_ID,
    type ChainAccountNative,
} from '@perawallet/wallet-core-chain-contract'
import type { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    generateOrderedUniqueId,
    type Network,
} from '@perawallet/wallet-core-shared'
import { AccountError } from '../errors'
import {
    AccountTypes,
    DerivationTypes,
    type AccountChains,
    type AccountCustody,
    type Algo25Account,
    type ChainAccount,
    type HardwareWalletAccount,
    type HDWalletAccount,
    type LocalCustody,
    type MultiSigAccount,
    type QuantumAccount,
    type WalletAccount,
    type WatchAccount,
} from '../models'

// The legacy `keyPairId` and multisig details are the Algorand ones, so a local
// or multisig account must have them on its Algorand entry.
type ChainEntryFor<C extends AccountCustody> = C extends { kind: 'local' }
    ? ChainAccount & { keyPairId: string }
    : C extends { kind: 'multisig' }
      ? ChainAccount & {
            native: ChainAccountNative & {
                multisig: NonNullable<ChainAccountNative['multisig']>
            }
        }
      : ChainAccount

export type BuildAccountInput<C extends AccountCustody = AccountCustody> = {
    /** Defaults to a fresh ordered unique id. */
    id?: string
    name?: string
    custody: C
    chains: AccountChains & Record<typeof LEGACY_CHAIN_ID, ChainEntryFor<C>>
    rekeyAddress?: string
    rekeyAddressByNetwork?: Partial<Record<Network, string>>
}

/** The legacy account variant a custody maps onto. */
export type AccountForCustody<C extends AccountCustody> = C extends {
    kind: 'hardware'
}
    ? HardwareWalletAccount
    : C extends { kind: 'multisig' }
      ? MultiSigAccount
      : C extends { kind: 'watch' }
        ? WatchAccount
        : C extends { seed: typeof SeedScheme.Bip39 }
          ? HDWalletAccount
          : C extends { seed: typeof SeedScheme.Quantum }
            ? QuantumAccount
            : C extends { seed: typeof SeedScheme.Algo25 }
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
    custody: LocalCustody,
    chain: ChainAccount,
): LegacyFields => {
    const { keyPairId } = chain
    if (!keyPairId) {
        throw new AccountError(
            'A local account needs a key on the Algorand chain',
        )
    }
    if (custody.seed === 'bip39') {
        return {
            type: AccountTypes.hdWallet,
            keyPairId,
            hdWalletDetails: {
                account: custody.hd.account,
                change: 0,
                keyIndex: custody.hd.keyIndex,
                derivationType: DerivationTypes.Peikert,
            },
        }
    }
    return {
        type:
            custody.seed === 'quantum'
                ? AccountTypes.quantum
                : AccountTypes.algo25,
        keyPairId,
    }
}

const legacyFieldsOf = (
    custody: AccountCustody,
    chain: ChainAccount,
): LegacyFields => {
    switch (custody.kind) {
        case 'local': {
            return localLegacyFieldsOf(custody, chain)
        }
        case 'hardware': {
            return {
                type: AccountTypes.hardware,
                hardwareDetails: {
                    ...custody.device,
                    accountIndex: custody.accountIndex,
                },
            }
        }
        case 'multisig': {
            const multisig = chain.native?.multisig
            if (!multisig) {
                throw new AccountError(
                    'A multisig account needs its multisig on the Algorand chain',
                )
            }
            return {
                type: AccountTypes.multisig,
                multisigDetails: {
                    threshold: multisig.threshold,
                    addresses: [...multisig.addresses],
                    version: multisig.version,
                },
            }
        }
        case 'watch': {
            return { type: AccountTypes.watch }
        }
    }
}

/**
 * Builds a {@link WalletAccount} from its custody and per-chain entries. The
 * legacy `type`, top-level `address` and details object are derived from them,
 * so they can't disagree.
 */
export const buildAccount = <C extends AccountCustody>(
    input: BuildAccountInput<C>,
): AccountForCustody<C> => {
    const {
        id,
        name,
        custody,
        chains,
        rekeyAddress,
        rekeyAddressByNetwork,
    } = input
    const algorand: ChainAccount = chains[LEGACY_CHAIN_ID]
    return {
        id: id ?? generateOrderedUniqueId(),
        ...(name !== undefined ? { name } : {}),
        address: algorand.address,
        ...legacyFieldsOf(custody, algorand),
        ...(rekeyAddress !== undefined ? { rekeyAddress } : {}),
        ...(rekeyAddressByNetwork !== undefined
            ? { rekeyAddressByNetwork }
            : {}),
        custody,
        chains,
    } as unknown as AccountForCustody<C>
}
