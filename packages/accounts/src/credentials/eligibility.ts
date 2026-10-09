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
    ChainId,
    ChainScope,
    SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { HdIndex, WalletAccount } from '../models'
import { findAccountByAddressOn } from '../utils'
import { chainAccountOf, hasCustody, hdIndexOf, seedOf } from './accessors'
import type { KeystoreSnapshot } from './credentialScheme'

/**
 * The first of the chain's signing schemes that a seed can mint through a
 * derivation path, so `canDerive` and the derivation itself agree on it.
 */
export const seedMintableScheme = (
    chainId: ChainId,
): SigningScheme | undefined => {
    const { chains } = getProvider()
    if (!chains.has(chainId)) return undefined
    const { schemes, derivationPaths } = chains.get(chainId).descriptor.signing
    return schemes.find(scheme => derivationPaths[scheme])
}

/**
 * Whether the wallet `walletId` (a seed's KMS id, as `seedOf` returns) can mint
 * an account for `chainId`. Adapter presence is left to the capability parity
 * test, as in `useChainCapability`.
 */
export const canDerive = (
    accounts: readonly WalletAccount[],
    walletId: string,
    chainId: ChainId,
    keys?: KeystoreSnapshot,
): boolean => {
    if (seedMintableScheme(chainId) === undefined) return false
    return accounts.some(
        account =>
            hasCustody(account, 'local') &&
            account.custody.seed === 'bip39' &&
            seedOf(account, keys) === walletId,
    )
}

/** Whether the chain imports an account from raw private-key bytes. */
export const canImportRawKey = (chainId: ChainId): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(chainId) &&
        chains.get(chainId).descriptor.signing.rawKeySchemes.length > 0 &&
        chains.capabilities(chainId).privateKeys
    )
}

/** The account at `index` in wallet `walletId`, whatever chains it spans. */
export const findPathHolder = (
    accounts: readonly WalletAccount[],
    walletId: string,
    index: HdIndex,
    keys?: KeystoreSnapshot,
): WalletAccount | undefined =>
    accounts.find(account => {
        const held = hdIndexOf(account)
        // The index test goes first because `seedOf` scans the keystore.
        return (
            held?.account === index.account &&
            held.keyIndex === index.keyIndex &&
            seedOf(account, keys) === walletId
        )
    })

/**
 * The lowest position of wallet `walletId` (by account, then keyIndex) with no
 * entry on `chainId`, or `{ max account + 1, 0 }` once every position has one.
 */
export const nextChainPosition = (
    accounts: readonly WalletAccount[],
    walletId: string,
    chainId: ChainId,
    keys?: KeystoreSnapshot,
): HdIndex => {
    const positions = accounts
        .flatMap(account => {
            const index = hdIndexOf(account)
            return index && seedOf(account, keys) === walletId
                ? [{ account, index }]
                : []
        })
        .sort(
            (a, b) =>
                a.index.account - b.index.account ||
                a.index.keyIndex - b.index.keyIndex,
        )
    const free = positions.find(
        ({ account }) => !chainAccountOf(account, chainId),
    )
    if (free) return { ...free.index }
    const last = positions.at(-1)
    return { account: last ? last.index.account + 1 : 0, keyIndex: 0 }
}

/** The account holding `address` on `scope`, compared through the chain codec. */
export const findAddressHolder = (
    accounts: readonly WalletAccount[],
    scope: ChainScope,
    address: string,
): WalletAccount | undefined =>
    findAccountByAddressOn(accounts, scope.chainId, address)
