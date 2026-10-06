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
    ChainAccount,
    HardwareRef,
    HdIndex,
    WalletAccount,
} from '../models'
import type { KeystoreSnapshot } from './credentialScheme'

// A record the backfill left without `custody` is answered from the legacy
// top-level fields, which are the Algorand chain's.

/** `undefined` only for a record the backfill left bare. */
export const custodyOf = (account: WalletAccount): AccountCustody | undefined =>
    account.custody

export const hasCustody = <K extends AccountCustody['kind']>(
    account: WalletAccount,
    kind: K,
): account is WalletAccount & { custody: Extract<AccountCustody, { kind: K }> } =>
    account.custody?.kind === kind

export const chainAccountOf = (
    account: WalletAccount,
    chainId: ChainId,
): ChainAccount | undefined => {
    const entry = account.chains?.[chainId]
    if (entry) return entry
    if (chainId !== LEGACY_CHAIN_ID || account.address === undefined) {
        return undefined
    }
    return {
        address: account.address,
        ...(account.keyPairId !== undefined
            ? { keyPairId: account.keyPairId }
            : {}),
    }
}

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
    if (custody) {
        return custody.kind === 'local' && custody.seed === 'bip39'
            ? custody.hd
            : undefined
    }
    const details = account.type === 'hdWallet' && account.hdWalletDetails
    return details
        ? { account: details.account, keyIndex: details.keyIndex }
        : undefined
}

export const hardwareDeviceOf = (
    account: WalletAccount,
): { device: HardwareRef; accountIndex: number } | undefined => {
    const { custody } = account
    if (custody) {
        return custody.kind === 'hardware'
            ? { device: custody.device, accountIndex: custody.accountIndex }
            : undefined
    }
    if (account.type !== 'hardware' || !account.hardwareDetails) {
        return undefined
    }
    const { accountIndex, ...device } = account.hardwareDetails
    return { device, accountIndex }
}

/**
 * The KMS id of the seed behind the account's local keys, or `undefined` for
 * non-local custody or a key the snapshot lacks.
 */
export const seedOf = (
    account: WalletAccount,
    keys: KeystoreSnapshot = getKeystoreStore().state.keys,
): string | undefined => {
    const { custody } = account
    if (custody && custody.kind !== 'local') return undefined
    const keyPairId =
        Object.values(account.chains ?? {}).find(entry => entry?.keyPairId)
            ?.keyPairId ?? account.keyPairId
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
 */
export const authorityOf = (
    account: WalletAccount,
    scope: ChainScope,
): string | null => {
    if (scope.chainId !== LEGACY_CHAIN_ID) return null
    const { rekeyAddressByNetwork, rekeyAddress } = account
    // An account that predates the per-network map only has the mirror, as
    // `applyNetworkRekeyState` assumes.
    if (!rekeyAddressByNetwork) return rekeyAddress ?? null
    return isLegacyNetwork(scope.networkId)
        ? (rekeyAddressByNetwork[scope.networkId] ?? null)
        : null
}
