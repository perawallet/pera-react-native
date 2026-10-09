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

import type {
    ChainAccount,
    HardwareRef,
    HdIndex,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import { seedAuthority } from '../accounts/__tests__/seedAuthority'
import { ALGORAND_CHAIN_ID } from '../chain-id'

export type AlgorandAccountOptions = {
    id?: string
    name?: string
    /** Recorded on mainnet's chain-state slice, as a sync would, when the account is built. */
    authorityAddress?: string
    /** Defaults to `kp-<address>` for local accounts; `null` leaves the key off. */
    keyPairId?: string | null
}

export const LEDGER_DEVICE: HardwareRef = {
    manufacturer: 'ledger',
    deviceId: 'device-1',
    deviceName: 'Nano X',
    transportType: 'ble',
}

const withOptions = (
    account: Pick<WalletAccount, 'custody'>,
    entry: ChainAccount,
    { id, name, authorityAddress }: AlgorandAccountOptions = {},
): WalletAccount => {
    if (authorityAddress !== undefined) {
        seedAuthority(entry.address, authorityAddress)
    }
    return {
        id: id ?? `id-${entry.address}`,
        ...(name !== undefined ? { name } : {}),
        custody: account.custody,
        chains: { [ALGORAND_CHAIN_ID]: entry },
    }
}

const localEntry = (
    address: string,
    keyPairId: AlgorandAccountOptions['keyPairId'],
): ChainAccount =>
    keyPairId === null
        ? { address }
        : { address, keyPairId: keyPairId ?? `kp-${address}` }

export const standaloneAccount = (
    address: string,
    options: AlgorandAccountOptions = {},
): WalletAccount =>
    withOptions(
        { custody: { kind: 'local', seed: null } },
        localEntry(address, options.keyPairId),
        options,
    )

export const quantumAccount = (
    address: string,
    options: AlgorandAccountOptions = {},
): WalletAccount =>
    withOptions(
        { custody: { kind: 'local', seed: 'quantum' } },
        localEntry(address, options.keyPairId),
        options,
    )

export const hdAccount = (
    address: string,
    options: AlgorandAccountOptions & { hd?: HdIndex } = {},
): WalletAccount =>
    withOptions(
        {
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: options.hd ?? { account: 0, keyIndex: 0 },
            },
        },
        localEntry(address, options.keyPairId),
        options,
    )

export const hardwareAccount = (
    address: string,
    options: AlgorandAccountOptions & {
        device?: HardwareRef
        accountIndex?: number
    } = {},
): WalletAccount =>
    withOptions(
        {
            custody: {
                kind: 'hardware',
                device: options.device ?? LEDGER_DEVICE,
                accountIndex: options.accountIndex ?? 0,
            },
        },
        { address },
        options,
    )

export const watchAccount = (
    address: string,
    options: AlgorandAccountOptions = {},
): WalletAccount =>
    withOptions({ custody: { kind: 'watch' } }, { address }, options)

/** `parameters: null` models a legacy record that never carried them. */
export const multisigAccount = (
    address: string,
    parameters: Partial<MultisigParameters> | null,
    options: AlgorandAccountOptions = {},
): WalletAccount =>
    withOptions(
        { custody: { kind: 'multisig' } },
        parameters === null
            ? { address }
            : {
                  address,
                  native: {
                      family: 'algorand',
                      multisig: {
                          version: parameters.version ?? 1,
                          threshold: parameters.threshold ?? 2,
                          addresses: [...(parameters.addresses ?? [])],
                      },
                  },
              },
        options,
    )
