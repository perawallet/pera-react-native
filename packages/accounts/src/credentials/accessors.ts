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
    isLegacyNetwork,
    LEGACY_CHAIN_ID,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { resolveSeedKeyFrom } from '@perawallet/wallet-core-kms'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type {
    AccountCustody,
    AccountWithCustody,
    ChainAccount,
    HardwareRef,
    HardwareWalletDetails,
    HdIndex,
    WalletAccount,
} from '../models'
import { authAddressOf, getAccountChainState } from '../store/accountChainState'
import type { KeystoreSnapshot } from './credentialScheme'

export const custodyOf = (account: WalletAccount): AccountCustody =>
    account.custody

export const hasCustody = <K extends AccountCustody['kind']>(
    account: WalletAccount,
    kind: K,
): account is AccountWithCustody<K> => account.custody.kind === kind

export const chainAccountOf = (
    account: WalletAccount,
    chainId: ChainId,
): ChainAccount | undefined => account.chains[chainId]

/** Takes a scope so a chain whose encoding varies by network can answer per network. */
export const addressOn = (
    account: WalletAccount,
    scope: ChainScope,
): string | undefined => chainAccountOf(account, scope.chainId)?.address

export const signingKeyOn = (
    account: WalletAccount,
    chainId: ChainId,
): string | undefined => chainAccountOf(account, chainId)?.keyPairId

export const hdIndexOf = (account: WalletAccount): HdIndex | undefined => {
    const { custody } = account
    return custody.kind === 'local' && custody.seed === 'bip39'
        ? custody.hd
        : undefined
}

export const hardwareDeviceOf = (
    account: WalletAccount,
): { device: HardwareRef; accountIndex: number } | undefined => {
    const { custody } = account
    return custody.kind === 'hardware'
        ? { device: custody.device, accountIndex: custody.accountIndex }
        : undefined
}

/** The device record a hardware account was paired with, flattened as the store and Ledger flows keep it. */
export const hardwareDetailsOf = (
    account: WalletAccount,
): HardwareWalletDetails | undefined => {
    const held = hardwareDeviceOf(account)
    return held
        ? { ...held.device, accountIndex: held.accountIndex }
        : undefined
}

/** Every local seed scheme is mnemonic-backed, so a local account has a phrase to back up or reveal. */
export const hasRecoverySeed = (account: WalletAccount): boolean =>
    account.custody.kind === 'local'

/**
 * The KMS id of the seed behind the account's local keys, or `undefined` for
 * non-local custody or a key the snapshot lacks.
 */
export const seedOf = (
    account: WalletAccount,
    keys: KeystoreSnapshot = getKeystoreStore().state.keys,
): string | undefined => {
    const { custody } = account
    if (custody.kind !== 'local') return undefined
    const keyPairId = Object.values(account.chains).find(
        entry => entry?.keyPairId,
    )?.keyPairId
    if (!keyPairId) return undefined
    try {
        return resolveSeedKeyFrom(keys, keyPairId).id
    } catch {
        return undefined
    }
}

/**
 * The address whose key authorises the account on `scope`, or `null` when it
 * signs for itself. Observed chain state, so it never joins the account record.
 * Reads the chain-state slice, falling back to the legacy record fields for a
 * scope the slice doesn't hold yet.
 */
export const authorityOf = (
    account: WalletAccount,
    scope: ChainScope,
): string | null => {
    const address = addressOn(account, scope)
    const state =
        address === undefined ? undefined : getAccountChainState(scope, address)
    if (state) return authAddressOf(state)
    if (scope.chainId !== LEGACY_CHAIN_ID) return null
    const { rekeyAddressByNetwork, rekeyAddress } = account
    // An account that predates the per-network map only has the mirror, as
    // `applyNetworkRekeyState` assumes.
    if (!rekeyAddressByNetwork) return rekeyAddress ?? null
    return isLegacyNetwork(scope.networkId)
        ? (rekeyAddressByNetwork[scope.networkId] ?? null)
        : null
}
