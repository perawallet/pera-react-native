/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    useDeviceID,
    useUpdateDeviceMutation,
} from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useAccountsStore } from '../store'
import { AccountTypes, WalletAccount } from '../models'
import { logger } from '@perawallet/wallet-core-shared'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import {
    algo25SignKeyId,
    hdDerivedKeyId,
    KeyNotFoundError,
    useKMS,
} from '@perawallet/wallet-core-kms'
import { NoHDWalletError } from '../errors'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

export type Algo25SeedReference = {
    /** Keystore id of the algo25 seed entry. */
    seedKeyId: string
    /** Encoded Algorand address derived from the seed. */
    address: string
}

export const useCreateAccount = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const deviceInfo = getProvider().deviceInfo
    const { mutateAsync: updateDeviceOnBackend } = useUpdateDeviceMutation()
    const { getKey, createHDWalletKey, createAlgo25Key, getDerivedPublicKey } =
        useKMS()

    const saveAndUpdateAccounts = async (newAccount: WalletAccount) => {
        // Read accounts FRESH inside the handler — never use a snapshot
        // captured at hook-render time. Async actions (e.g. createHDWalletKey)
        // can finish after the store has been wiped (delete-all-data flow),
        // and a stale closure here would otherwise re-introduce the cleared
        // accounts when we wrote `[...staleAccounts, newAccount]` back. Also
        // never mutate the snapshot — zustand state is meant to be immutable.
        const currentAccounts = useAccountsStore.getState().accounts
        const nextAccounts = [...currentAccounts, newAccount]
        setAccounts(nextAccounts)

        if (deviceID) {
            try {
                await updateDeviceOnBackend({
                    deviceId: deviceID,
                    data: {
                        platform: deviceInfo.getDevicePlatform(),
                        accounts: nextAccounts.map(a => a.address),
                    },
                })
            } catch (e) {
                logger.warn('Failed to sync account with backend', { error: e })
            }
        }
    }

    const createHdWalletAccount = async ({
        walletId,
        account,
        keyIndex,
    }: {
        walletId?: string
        account: number
        keyIndex: number
    }) => {
        const rootWalletId = walletId ?? generateOrderedUniqueId()
        let seedKeyId: string | undefined = getKey(rootWalletId)?.id

        if (!seedKeyId) {
            const result = await createHDWalletKey({ id: rootWalletId })
            seedKeyId = result.seedKey.id
        }

        if (!seedKeyId) {
            throw new NoHDWalletError(rootWalletId)
        }

        // The derived child is what `account.keyPairId` references — and
        // what every signing call hits via `keyStore.sign(keyPairId, data)`.
        // The seed parent is reachable via the child's `metadata.parentKeyId`.
        // `getDerivedPublicKey` mints (or no-ops, since the id is
        // deterministic) the child and reads its publicKey from the live
        // reactive store — we can't use `keyStore.export` because the
        // rn-keystore stamps derived keys `extractable: false`.
        const derivationType = BIP32DerivationType.Peikert
        const publicKey = await getDerivedPublicKey(
            seedKeyId,
            account,
            keyIndex,
            derivationType,
        )

        if (!publicKey) {
            throw new NoHDWalletError(rootWalletId)
        }

        const newAccount: WalletAccount = {
            id: generateOrderedUniqueId(),
            address: encodeAlgorandAddress(publicKey),
            type: AccountTypes.hdWallet,
            hdWalletDetails: {
                account,
                change: 0,
                keyIndex,
                derivationType,
            },
            keyPairId: hdDerivedKeyId(
                seedKeyId,
                account,
                keyIndex,
                derivationType,
            ),
        }

        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    const createAlgo25WalletAccount = async ({
        seed,
        id,
    }: {
        // Pass a freshly-minted seed reference here (e.g. from the import
        // flow) to skip `getKey()`. `getKey` reads a `useMemo` bound to the
        // *previous render's* keystore snapshot, so a key committed earlier
        // in the same async handler isn't visible yet — without this we'd
        // fall through to the no-mnemonic branch below and mint an algo25
        // key from a fresh random seed, surfacing a different (random)
        // address each import.
        seed?: Algo25SeedReference
        id?: string
    }) => {
        let resolved: Algo25SeedReference | null = seed ?? null

        if (!resolved) {
            const keyId = id ?? generateOrderedUniqueId()
            const existing = getKey(keyId)
            if (existing) {
                // Re-importing under a known seed id: use the existing entry.
                // The seed itself doesn't carry the algo25 address, so we
                // just derive it via the deterministic child id (which is
                // already persisted) — its publicKey gives us the address.
                resolved = {
                    seedKeyId: existing.id,
                    address: encodeAlgorandAddress(
                        existing.publicKey ?? new Uint8Array(),
                    ),
                }
            } else {
                const result = await createAlgo25Key({ id: keyId })
                resolved = {
                    seedKeyId: result.seedKey.id,
                    address: result.address,
                }
            }
        }

        if (!resolved?.seedKeyId) {
            throw new KeyNotFoundError(id ?? '')
        }

        const newAccount: WalletAccount = {
            id: generateOrderedUniqueId(),
            address: resolved.address,
            type: AccountTypes.algo25,
            // The algo25 child key is committed deterministically alongside
            // the seed at `${seedKeyId}-ed25519`. Accounts reference the
            // child directly, so signing is just `keyStore.sign(keyPairId, ...)`.
            keyPairId: algo25SignKeyId(resolved.seedKeyId),
        }

        await saveAndUpdateAccounts(newAccount)
        return newAccount
    }

    return {
        createHdWalletAccount,
        createAlgo25WalletAccount,
    }
}
