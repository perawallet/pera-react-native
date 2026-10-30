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
    addressCodecs,
    type ChainDescriptor,
    type ChainFamily,
    type ChainId,
    type ChainScope,
    type SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { hasLedgerAppDriver } from '@perawallet/wallet-core-hardware-wallet'
import { SeedScheme, seedSchemeOf } from '@perawallet/wallet-core-kms'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import type { Optional } from '@perawallet/wallet-core-shared'
import { accountsChainAdapters } from '../chain-adapter'
import type {
    HardwareWalletAccount,
    HardwareWalletDetails,
    HdIndex,
    WalletAccount,
} from '../models'
import { findAccountByAddressOn } from '../utils'
import { chainAccountOf, hasCustody, hdIndexOf, seedOf } from './accessors'
import type { KeystoreSnapshot } from './credentialScheme'

/**
 * The first of the chain's signing schemes that a seed can mint through a
 * derivation path, so `canDerive` and the derivation itself agree on it.
 */
export const seedMintableScheme = (
    chainId: ChainId,
): Optional<SigningScheme> => {
    const { chains } = getProvider()
    if (!chains.has(chainId)) return undefined
    const { schemes, derivationPaths } = chains.get(chainId).descriptor.signing
    return schemes.find(scheme => derivationPaths[scheme])
}

/**
 * Whether the wallet `walletId` (a seed's KMS id, as `seedOf` returns) can mint
 * an account for `chainId`. The keystore holding the seed is enough: a restore
 * can persist a seed before any account of it exists on this device. Adapter
 * presence is left to the capability parity test, as in `useChainCapability`.
 */
export const canDerive = (
    accounts: readonly WalletAccount[],
    walletId: string,
    chainId: ChainId,
    keys?: KeystoreSnapshot,
): boolean => {
    if (seedMintableScheme(chainId) === undefined) return false
    const held = keys ?? getKeystoreStore().state.keys
    if (
        held.some(
            key =>
                key.id === walletId && seedSchemeOf(key) === SeedScheme.Bip39,
        )
    ) {
        return true
    }
    return accounts.some(
        account =>
            hasCustody(account, 'local') &&
            account.custody.seed === 'bip39' &&
            seedOf(account, held) === walletId,
    )
}

/**
 * The raw-key scheme a standalone key signs with, by the family of each chain
 * it is enabled on. A key moves only within its family, and only to a chain
 * that imports the same scheme.
 */
export const standaloneKeySchemes = (
    enabled: readonly ChainDescriptor[],
): Map<ChainFamily, SigningScheme> => {
    const schemes = new Map<ChainFamily, SigningScheme>()
    for (const { family, signing } of enabled) {
        const scheme = signing.rawKeySchemes[0]
        if (scheme !== undefined && !schemes.has(family)) {
            schemes.set(family, scheme)
        }
    }
    return schemes
}

const reachesChain = (
    account: WalletAccount,
    enabled: readonly ChainDescriptor[],
): ((descriptor: ChainDescriptor) => boolean) => {
    const { custody } = account
    switch (custody.kind) {
        case 'local': {
            if (custody.seed === 'bip39') {
                return ({ id }) => seedMintableScheme(id) !== undefined
            }
            if (custody.seed !== null) return () => false
            const schemes = standaloneKeySchemes(enabled)
            return ({ family, signing }) => {
                const scheme = schemes.get(family)
                return (
                    scheme !== undefined &&
                    signing.rawKeySchemes.includes(scheme)
                )
            }
        }
        case 'watch': {
            const held = enabled[0]
            const address = held && chainAccountOf(account, held.id)?.address
            if (address === undefined) return () => false
            return ({ id }) =>
                addressCodecs.has(id) &&
                addressCodecs
                    .get(id)
                    .isValid(
                        address,
                        selectChainNetworkId(useNetworkStore.getState(), id),
                    )
        }
        case 'hardware': {
            return ({ id }) => hasLedgerAppDriver(id)
        }
        default: {
            return () => false
        }
    }
}

/**
 * Every registered chain the account's custody can produce its address on,
 * in registry order; the chains it is already enabled on always count.
 */
export const eligibleChains = (account: WalletAccount): ChainId[] => {
    const registered = getProvider().chains.list()
    const isEnabled = ({ id }: ChainDescriptor) =>
        chainAccountOf(account, id) !== undefined
    const reaches = reachesChain(account, registered.filter(isEnabled))
    return registered
        .filter(descriptor => isEnabled(descriptor) || reaches(descriptor))
        .map(({ id }) => id)
}

/**
 * The eligible chains in a family the account is already enabled in: what a
 * first use or a discovery probe may add without crossing chain families. A
 * new family stays an explicit step, so an existing single-family account
 * behaves as it did before more chains were registered.
 */
export const eligibleChainsInFamily = (account: WalletAccount): ChainId[] => {
    const { chains } = getProvider()
    const families = new Set(
        chains
            .list()
            .filter(({ id }) => chainAccountOf(account, id) !== undefined)
            .map(({ family }) => family),
    )
    return eligibleChains(account).filter(id =>
        families.has(chains.get(id).descriptor.family),
    )
}

/**
 * The chains an HD wallet's discovery walk probes, in registry order: every
 * registered chain a BIP39 seed mints on that has an accounts adapter and is
 * not switched off.
 */
export const hdDiscoveryChains = (): ChainId[] => {
    const { chains } = getProvider()
    return chains
        .list()
        .map(({ id }) => id)
        .filter(
            id =>
                seedMintableScheme(id) !== undefined &&
                accountsChainAdapters.has(id) &&
                !chains.isSwitchedOff(id),
        )
}

/** Whether the chain is registered and flagged to be enabled on a new account unasked. */
export const isEnabledByDefault = (chainId: ChainId): boolean => {
    const { chains } = getProvider()
    return (
        chains.has(chainId) && chains.get(chainId).descriptor.enabledByDefault
    )
}

/** The eligible chains a new account starts enabled on, in registry order. */
export const defaultChains = (account: WalletAccount): ChainId[] =>
    eligibleChains(account).filter(isEnabledByDefault)

/** The first default chain among `chainIds`, else the first of them. */
export const preferDefaultChain = (
    chainIds: readonly ChainId[],
): Optional<ChainId> => chainIds.find(isEnabledByDefault) ?? chainIds[0]

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
): Optional<WalletAccount> =>
    accounts.find(account => {
        const held = hdIndexOf(account)
        // The index test goes first because `seedOf` scans the keystore.
        return (
            held?.account === index.account &&
            held.keyIndex === index.keyIndex &&
            seedOf(account, keys) === walletId
        )
    })

type HardwarePosition = Pick<
    HardwareWalletDetails,
    'manufacturer' | 'deviceId' | 'accountIndex' | 'transportType'
>

// Only a Bluetooth id names one device: a USB id names a model, so two
// devices on different seeds share it, and a USB position holds no account.
const isAtHardwarePosition = (
    account: WalletAccount,
    details: HardwarePosition,
): account is HardwareWalletAccount =>
    details.transportType === 'ble' &&
    hasCustody(account, 'hardware') &&
    account.custody.accountIndex === details.accountIndex &&
    account.custody.device.deviceId === details.deviceId &&
    account.custody.device.transportType === 'ble' &&
    account.custody.device.manufacturer === details.manufacturer

/**
 * The hardware account at this Bluetooth device position, whatever chains it
 * spans. Keyed on the stored device id, so a re-paired device that rotated its
 * id reads as another device until a re-import rebinds it.
 */
export const findHardwareHolder = (
    accounts: readonly WalletAccount[],
    details: HardwarePosition,
): Optional<HardwareWalletAccount> =>
    accounts.find(account => isAtHardwarePosition(account, details))

/**
 * The hardware accounts at this Bluetooth device position holding none of
 * `chainIds`: those entries on `chainIds` could join. Passphrase seeds share a
 * device id, so join one only once the device reads that account's address on
 * a chain it already holds.
 */
export const hardwareJoinCandidates = (
    accounts: readonly WalletAccount[],
    details: HardwarePosition,
    chainIds: readonly ChainId[],
): HardwareWalletAccount[] =>
    accounts.filter(
        (account): account is HardwareWalletAccount =>
            isAtHardwarePosition(account, details) &&
            chainIds.every(chainId => !chainAccountOf(account, chainId)),
    )

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
): Optional<WalletAccount> =>
    findAccountByAddressOn(accounts, scope.chainId, address)
