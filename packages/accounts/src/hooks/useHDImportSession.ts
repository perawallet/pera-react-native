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

import { useCallback } from 'react'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { prepareHDMasterKey, useKMS } from '@perawallet/wallet-core-kms'
import { useHDImportSessionStore } from '../import-session'
import { discoverAccounts, createXHDGetPublicKey } from '../account-discovery'
import type { HDWalletAccount } from '../models/accounts'
import { useAccountsStore } from '../store'
import { HDImportSessionNotFoundError } from '../errors'

export type UseHDImportSessionResult = {
    prepareImport: (params: { mnemonicIndices?: Uint16Array }) => Promise<{
        walletKeyId: string
        derivationType: BIP32DerivationType
    }>
    discoverImportAccounts: (params: {
        walletKeyId: string
    }) => Promise<HDWalletAccount[]>
    commitImport: (params: {
        walletKeyId: string
        selectedAccounts: HDWalletAccount[]
    }) => Promise<HDWalletAccount[]>
    cancelImport: () => void
}

export const useHDImportSession = (): UseHDImportSessionResult => {
    const { persistHDMasterKey, generateDerivedKey, removeKeyAndChildren } =
        useKMS()
    const setAccounts = useAccountsStore(state => state.setAccounts)

    const prepareImport = useCallback(
        async ({ mnemonicIndices }: { mnemonicIndices?: Uint16Array }) => {
            const prepared = await prepareHDMasterKey({ mnemonicIndices })
            const derivationType = BIP32DerivationType.Peikert
            useHDImportSessionStore.getState().start({
                walletKeyId: prepared.keyId,
                rootKey: prepared.rootKey,
                entropy: prepared.entropy,
                derivationType,
            })
            return { walletKeyId: prepared.keyId, derivationType }
        },
        [],
    )

    const discoverImportAccounts = useCallback(
        async ({ walletKeyId }: { walletKeyId: string }) => {
            const pending = useHDImportSessionStore.getState().pending
            if (!pending || pending.walletKeyId !== walletKeyId) {
                throw new HDImportSessionNotFoundError(walletKeyId)
            }
            const getPublicKey = createXHDGetPublicKey(pending.rootKey)
            return discoverAccounts({
                getPublicKey,
                derivationType: pending.derivationType,
                walletKeyId: pending.walletKeyId,
            })
        },
        [],
    )

    // NOTE: `persistHDMasterKey`'s identity is unstable across renders, so
    // this `useCallback` is effectively a no-op for memoization purposes.
    // It is kept for surface consistency with the other functions returned
    // by this hook, all of which are wrapped in `useCallback`.
    const commitImport = useCallback(
        async ({
            walletKeyId,
            selectedAccounts,
        }: {
            walletKeyId: string
            selectedAccounts: HDWalletAccount[]
        }) => {
            const pending = useHDImportSessionStore.getState().pending
            if (!pending || pending.walletKeyId !== walletKeyId) {
                throw new HDImportSessionNotFoundError(walletKeyId)
            }

            await persistHDMasterKey({
                keyId: pending.walletKeyId,
                rootKey: pending.rootKey,
                entropy: pending.entropy,
            })

            try {
                await Promise.all(
                    selectedAccounts.map(acc =>
                        generateDerivedKey(
                            pending.walletKeyId,
                            acc.hdWalletDetails.account,
                            acc.hdWalletDetails.keyIndex,
                            acc.hdWalletDetails.derivationType,
                        ),
                    ),
                )
            } catch (e) {
                // Roll back the seed + any successfully-derived children so
                // the keystore doesn't end up with a half-imported wallet.
                // Seed ids are deterministic, but partial state would still
                // shadow a future retry's view of which children exist.
                try {
                    await removeKeyAndChildren(pending.walletKeyId)
                } catch {
                    // Best-effort cleanup; surface the original failure.
                }
                throw e
            }

            const existing = useAccountsStore.getState().accounts
            const next = [...existing, ...selectedAccounts]
            setAccounts(next)

            useHDImportSessionStore.getState().resetState()

            return selectedAccounts
        },
        [
            persistHDMasterKey,
            generateDerivedKey,
            removeKeyAndChildren,
            setAccounts,
        ],
    )

    const cancelImport = useCallback(() => {
        useHDImportSessionStore.getState().resetState()
    }, [])

    return {
        prepareImport,
        discoverImportAccounts,
        commitImport,
        cancelImport,
    }
}
