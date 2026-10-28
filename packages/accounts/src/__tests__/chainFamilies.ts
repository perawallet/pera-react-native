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

import { vi } from 'vitest'
import {
    addressCodecs,
    CHAIN_CAPABILITIES,
    keyDerivations,
    type AddressCodec,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainFamily,
    type ChainId,
    type KeyDerivation,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '../chain-adapter'
import type { HdIndex } from '../models'

export const ALGORAND = 'algorand' as ChainId
export const EVM_CHAINS = [
    'ethereum',
    'base',
    'bsc',
    'arbitrum',
    'avalanche',
    'polygon',
] as ChainId[]
export const [ETHEREUM, BASE, , , , POLYGON] = EVM_CHAINS
const DEFAULT_CHAINS: readonly ChainId[] = [ALGORAND, ETHEREUM]

export const EVM_KEY_ID = 'raw-evm-key'
export const EVM_KEY_PUBLIC = new Uint8Array(20).fill(0xe0)
export const EVM_KEY_ADDRESS = `0x${'e0'.repeat(20)}`
export const ALGORAND_ADDRESS = 'A'.repeat(58)

const hex = (bytes: Uint8Array) =>
    [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')

/** One address per key, the same on every chain of a family. */
const familyAddress = (family: string, publicKey: Uint8Array): string =>
    family === 'evm'
        ? `0x${hex(publicKey).padEnd(40, '0').slice(0, 40)}`
        : hex(publicKey).toUpperCase().padEnd(58, 'Q').slice(0, 58)

const EVM_ADDRESS = /^0x[0-9a-f]{40}$/
const ALGORAND_STYLE_ADDRESS = /^[A-Z0-9]{58}$/

const descriptorFor = (id: ChainId, family: string): ChainDescriptor =>
    ({
        id,
        family,
        displayName: id,
        enabledByDefault: DEFAULT_CHAINS.includes(id),
        networks: [
            {
                id: 'mainnet',
                tier: 'mainnet',
                isDefaultForTier: true,
                status: 'active',
            },
        ],
        signing:
            family === 'evm'
                ? {
                      schemes: ['secp256k1'],
                      derivationPaths: {
                          secp256k1: (a: number, k: number) =>
                              `m/44'/60'/${a}'/0/${k}`,
                      },
                      rawKeySchemes: ['secp256k1'],
                  }
                : {
                      schemes: ['ed25519', 'falcon-1024'],
                      derivationPaths: {
                          ed25519: (a: number, k: number) =>
                              `m/44'/283'/${a}'/0/${k}`,
                      },
                      rawKeySchemes: ['ed25519'],
                  },
    }) as unknown as ChainDescriptor

const codecFor = (chainId: ChainId, family: string): AddressCodec => ({
    chainId,
    fromPublicKey: (publicKey: Uint8Array) => familyAddress(family, publicKey),
    isValid: (address: string) =>
        family === 'evm'
            ? EVM_ADDRESS.test(address.toLowerCase())
            : ALGORAND_STYLE_ADDRESS.test(address),
    normalize: (address: string) =>
        family === 'evm' ? address.toLowerCase() : address,
    areEqual: (a: string, b: string) =>
        family === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b,
    truncate: (address: string) => address,
    resembles: () => false,
    toPaymentUri: (address: string) => `${chainId}:${address}`,
    parsePaymentUri: () => undefined,
})

/** The per-family HD key id, so every chain of a family derives the same key. */
export const familyHdKeyId = (
    seedRef: string,
    family: string,
    account: number,
    keyIndex: number,
) => `${seedRef}-${family}-${account}-${keyIndex}`

export const familyHdPublicKey = (
    family: string,
    account: number,
    keyIndex: number,
) => new Uint8Array([family === 'evm' ? 0xe1 : 0xa1, account, keyIndex])

export const familyHdAddress = (
    family: string,
    account: number,
    keyIndex: number,
) => familyAddress(family, familyHdPublicKey(family, account, keyIndex))

const derivationFor = (chainId: ChainId, family: string): KeyDerivation => ({
    chainId,
    deriveAccount: vi.fn(async (_kms, seedRef, account, keyIndex) => ({
        keyPairId: familyHdKeyId(seedRef, family, account, keyIndex),
        publicKey: familyHdPublicKey(family, account, keyIndex),
        address: familyHdAddress(family, account, keyIndex),
    })),
    importRawKey: vi.fn(async () =>
        family === 'evm'
            ? { keyPairId: EVM_KEY_ID, address: EVM_KEY_ADDRESS }
            : { keyPairId: 'raw-algorand-key', address: ALGORAND_ADDRESS },
    ),
    discover: vi.fn(async () => []),
})

export type ChainFamilies = {
    /** Chains whose activity probe reports the address as active. */
    active: Set<ChainId>
    checkActivity: Map<ChainId, ReturnType<typeof vi.fn>>
    derivations: Map<ChainId, KeyDerivation>
}

const capabilitiesSetTo = (isOn: boolean) =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, isOn]),
    ) as ChainCapabilities

/**
 * Registers Algorand and six EVM chains, each with a codec, a derivation and
 * an accounts adapter whose activity probe reads `active`. A chain in
 * `switchedOff` has every capability off.
 */
export const registerChainFamilies = (
    chainIds: readonly ChainId[] = [ALGORAND, ...EVM_CHAINS],
    switchedOff: readonly ChainId[] = [],
): ChainFamilies => {
    const families: ChainFamilies = {
        active: new Set(),
        checkActivity: new Map(),
        derivations: new Map(),
    }
    getProvider().chains.reset()
    addressCodecs.reset()
    keyDerivations.reset()
    accountsChainAdapters.reset()
    for (const chainId of chainIds) {
        const family: ChainFamily | string = EVM_CHAINS.includes(chainId)
            ? 'evm'
            : 'algorand'
        getProvider().chains.register(
            descriptorFor(chainId, family),
            capabilitiesSetTo(!switchedOff.includes(chainId)),
        )
        addressCodecs.register(codecFor(chainId, family))
        const derivation = derivationFor(chainId, family)
        keyDerivations.register(derivation)
        families.derivations.set(chainId, derivation)
        const checkActivity = vi.fn(
            async (addresses: string[]) =>
                new Map(
                    addresses.map(address => [
                        address,
                        families.active.has(chainId),
                    ]),
                ),
        )
        families.checkActivity.set(chainId, checkActivity)
        accountsChainAdapters.register({
            chainId,
            checkActivity,
            hdKeyPairId: (seedKeyId: string, { account, keyIndex }: HdIndex) =>
                familyHdKeyId(seedKeyId, family, account, keyIndex),
        } as unknown as AccountsChainAdapter)
    }
    return families
}

/** Lets `chainId` derive public keys from an in-memory root key, as Algorand's XHD root does. */
export const deriveInMemoryOn = (chainId: ChainId) => {
    const family = EVM_CHAINS.includes(chainId) ? 'evm' : 'algorand'
    const getPublicKey = vi.fn(async ({ account, keyIndex }: HdIndex) =>
        familyHdPublicKey(family, account, keyIndex),
    )
    const createPublicKeyGetter = vi.fn(() => getPublicKey)
    Object.assign(accountsChainAdapters.get(chainId), {
        createPublicKeyGetter,
    })
    return { createPublicKeyGetter, getPublicKey }
}
