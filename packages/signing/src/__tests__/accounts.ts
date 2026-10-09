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
import {
    accountsChainAdapters,
    type AccountCustody,
    type AccountsChainAdapter,
    type ChainAccount,
    type HardwareRef,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    multisigChainAdapters,
    type MultisigChainAdapter,
    type MultisigParameters,
} from '@perawallet/wallet-core-multisig'

/** The chain every signing spec signs on. */
export const TEST_CHAIN_ID = LEGACY_CHAIN_ID

type AccountOptions = Partial<Omit<WalletAccount, 'custody' | 'chains'>> & {
    keyPairId?: string
    native?: ChainAccount['native']
}

/** An account holding `address` on the signing chain; `id` defaults to the address. */
export const testAccount = (
    custody: AccountCustody,
    address: string,
    { keyPairId, native, ...overrides }: AccountOptions = {},
): WalletAccount => ({
    id: address,
    ...overrides,
    custody,
    chains: {
        [TEST_CHAIN_ID]: {
            address,
            ...(keyPairId ? { keyPairId } : {}),
            ...(native ? { native } : {}),
        },
    },
})

export const algo25Account = (
    address: string,
    options: AccountOptions = {},
): WalletAccount =>
    testAccount({ kind: 'local', seed: null }, address, {
        keyPairId: `key-${address}`,
        ...options,
    })

export const quantumAccount = (
    address: string,
    options: AccountOptions = {},
): WalletAccount =>
    testAccount({ kind: 'local', seed: SeedScheme.Quantum }, address, {
        keyPairId: `key-${address}`,
        ...options,
    })

export const hdAccount = (
    address: string,
    options: AccountOptions = {},
): WalletAccount =>
    testAccount(
        {
            kind: 'local',
            seed: SeedScheme.Bip39,
            hd: { account: 0, keyIndex: 0 },
        },
        address,
        { keyPairId: `key-${address}`, ...options },
    )

export const TEST_LEDGER_DEVICE: HardwareRef = {
    manufacturer: 'ledger',
    deviceId: 'device-1',
    deviceName: 'Nano X',
    transportType: 'ble',
}

export const ledgerAccount = (
    address: string,
    accountIndex = 0,
    device: Partial<HardwareRef> = {},
    options: AccountOptions = {},
): WalletAccount =>
    testAccount(
        {
            kind: 'hardware',
            device: { ...TEST_LEDGER_DEVICE, ...device },
            accountIndex,
        },
        address,
        options,
    )

export const watchAccount = (
    address: string,
    options: AccountOptions = {},
): WalletAccount => testAccount({ kind: 'watch' }, address, options)

/** Without `parameters` it is a record that never stored them. */
export const multisigAccount = (
    address: string,
    parameters?: MultisigParameters,
    options: AccountOptions = {},
): WalletAccount =>
    testAccount({ kind: 'multisig' }, address, {
        ...(parameters
            ? {
                  native: {
                      family: 'algorand',
                      multisig: {
                          ...parameters,
                          addresses: [...parameters.addresses],
                      },
                  },
              }
            : {}),
        ...options,
    })

const notStubbed = (member: string) => () => {
    throw new Error(`test multisig adapter: ${member} is not stubbed`)
}

/**
 * Registers a multisig adapter, and, when no accounts adapter is registered,
 * one that reads parameters the way {@link multisigAccount} stores them.
 */
export const registerTestMultisigAdapter = (): void => {
    if (!accountsChainAdapters.has(TEST_CHAIN_ID)) {
        accountsChainAdapters.register({
            chainId: TEST_CHAIN_ID,
            multisigNative: {
                parametersOf: native =>
                    native?.multisig
                        ? {
                              ...native.multisig,
                              addresses: [...native.multisig.addresses],
                          }
                        : undefined,
                withParameters: (native, parameters) => ({
                    ...native,
                    family: 'algorand',
                    multisig: parameters,
                }),
            },
        } as Partial<AccountsChainAdapter> as AccountsChainAdapter)
    }
    const adapter: MultisigChainAdapter = {
        chainId: TEST_CHAIN_ID,
        deriveAddress: notStubbed('deriveAddress'),
        assembleSignedTransactions: notStubbed('assembleSignedTransactions'),
        validateSignRequest: notStubbed('validateSignRequest'),
    }
    multisigChainAdapters.reset()
    multisigChainAdapters.register(adapter)
}
