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

import { type BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { seedFromMnemonic, type modelsv2 } from 'algosdk'
import {
    getAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    PQ_DERIVATION_CANONICAL,
    quantumAddressCandidates,
    useKMS,
    zeroBytes,
    type QuantumAddressCandidate,
} from '@perawallet/wallet-core-kms'
import {
    generateOrderedUniqueId,
    type Network,
} from '@perawallet/wallet-core-shared'
import { useCreateAccount } from './useCreateAccount'
import { useHDImportSession } from './useHDImportSession'
import { useAccountsStore } from '../store'
import {
    AccountTypes,
    type ImportAccountType,
    type WalletAccount,
} from '../models'
import { DuplicateAccountError } from '../errors'

export type ImportHDPendingResult = {
    type: 'hdWallet'
    walletKeyId: string
    derivationType: BIP32DerivationType
}

export type ImportAccountResult =
    | WalletAccount
    | WalletAccount[]
    | ImportHDPendingResult

// "Exists" is any on-chain footprint, not just a funded balance — an account
// can be meaningful (another account's auth-addr, or asset/app holder) at a
// zero ALGO balance.
const existsOnChain = (account: modelsv2.Account): boolean =>
    account.amount > 0n ||
    (account.assets?.length ?? 0) > 0 ||
    (account.appsLocalState?.length ?? 0) > 0 ||
    account.authAddr !== undefined

/**
 * Which of the two quantum derivations to mint. A probe failure returns both
 * candidates unfiltered — an extra empty account is harmless, but silently
 * dropping a funded legacy address is not. `candidates` is canonical-first,
 * so "neither exists" and "probe failed" both preserve that order.
 */
const resolveQuantumCandidatesToImport = async (
    candidates: QuantumAddressCandidate[],
    network: Network,
): Promise<QuantumAddressCandidate[]> => {
    try {
        const algokit: AlgorandClient = getAlgorandClient(network)
        const existence = await Promise.all(
            candidates.map(candidate =>
                algokit.client.algod
                    .accountInformation(candidate.address)
                    .do()
                    .then(existsOnChain),
            ),
        )
        const existing = candidates.filter((_, index) => existence[index])
        return existing.length > 0 ? existing : [candidates[0]]
    } catch {
        return candidates
    }
}

export const useImportAccount = () => {
    const {
        createAlgo25Key,
        createQuantumKey,
        removeKeyAndChildren,
        seedIdOf,
    } = useKMS()
    const {
        createAlgo25WalletAccount,
        createQuantumWalletAccount,
        saveAccount,
    } = useCreateAccount()
    const { prepareImport } = useHDImportSession()
    const { network } = useNetwork()

    // Shared by the algo25 and quantum branches: if the wallet already holds
    // this address, sweep the keystore entries the import attempt just
    // minted (seed + signing child) so repeated re-imports don't accumulate
    // orphans, then surface the duplicate.
    //
    // HD imports get the same protection at the selection screen — see
    // useImportSelectAddressesScreen, which filters already-imported
    // addresses out of the selectable set.
    //
    // A seed can now back more than one account — the dual-probe quantum
    // import puts both derivations on one seed record — so this must never
    // delete a seed a SIBLING account still depends on. Without this guard,
    // importing legacy right after canonical (both minted on one seed in the
    // same call) would delete canonical's just-persisted signing key the
    // moment legacy's address turned out to be a duplicate.
    const throwIfDuplicate = async (address: string, seedKeyId: string) => {
        const accounts = useAccountsStore.getState().accounts
        const isDuplicate = accounts.some(a => a.address === address)
        if (!isDuplicate) return

        const seedStillNeeded = accounts.some(
            a => a.address !== address && seedIdOf(a.keyPairId) === seedKeyId,
        )
        if (!seedStillNeeded) {
            try {
                await removeKeyAndChildren(seedKeyId)
            } catch {
                // Best-effort cleanup; don't shadow the duplicate error
                // with a keystore-removal failure.
            }
        }
        throw new DuplicateAccountError(address)
    }

    return async ({
        mnemonic,
        type,
    }: {
        mnemonic: string
        type: ImportAccountType
    }): Promise<ImportAccountResult> => {
        if (type === 'hdWallet') {
            const { walletKeyId, derivationType } = await prepareImport({
                mnemonic,
            })
            return { type: 'hdWallet', walletKeyId, derivationType }
        }

        if (type === 'quantum') {
            // A quantum mnemonic is 25 words — indistinguishable from algo25
            // by count. Reaching this branch requires the caller to have
            // picked quantum EXPLICITLY (dedicated entrypoint);
            // resolveImportAccountType never auto-detects it.
            //
            // Re-importing 25 words on a fresh device could land on either
            // derivation's address depending on which tool minted the
            // account originally, so probe both on chain and adopt whatever
            // actually exists (see quantumAddressCandidates/).
            const entropy = seedFromMnemonic(mnemonic)
            let candidates: QuantumAddressCandidate[]
            try {
                candidates = quantumAddressCandidates(entropy)
            } finally {
                zeroBytes(entropy)
            }

            const toImport = await resolveQuantumCandidatesToImport(
                candidates,
                network,
            )

            // Drop any candidate the wallet already holds BEFORE minting
            // anything, so a legacy address that's already an account can
            // never trigger the post-mint duplicate sweep against a seed
            // record the just-minted canonical sibling depends on. If the
            // probe's whole selection turns out to already be held, there's
            // nothing new to import.
            const heldAddresses = new Set(
                useAccountsStore.getState().accounts.map(a => a.address),
            )
            const newCandidates = toImport.filter(
                candidate => !heldAddresses.has(candidate.address),
            )
            if (newCandidates.length === 0) {
                throw new DuplicateAccountError(toImport[0].address)
            }

            const imported: WalletAccount[] = []
            // The second derivation (if any) attaches to the SAME seed
            // record as a second child — two children, one seed, so the
            // entropy is never persisted twice.
            let seedKeyId: string | undefined
            for (const candidate of newCandidates) {
                const result = await createQuantumKey({
                    mnemonic,
                    derivation: candidate.derivation,
                    reuseSeedId: seedKeyId,
                })
                seedKeyId = result.seedKey.id
                await throwIfDuplicate(result.address, result.seedKey.id)

                if (candidate.derivation === PQ_DERIVATION_CANONICAL) {
                    imported.push(
                        await createQuantumWalletAccount({
                            seed: {
                                seedKeyId: result.seedKey.id,
                                address: result.address,
                            },
                        }),
                    )
                } else {
                    // createQuantumWalletAccount's `seed` path always builds
                    // the canonical keyPairId, so the legacy child is saved
                    // directly using the id createQuantumKey actually minted.
                    const legacyAccount: WalletAccount = {
                        id: generateOrderedUniqueId(),
                        address: result.address,
                        type: AccountTypes.quantum,
                        keyPairId: result.signKeyId,
                    }
                    await saveAccount(legacyAccount)
                    imported.push(legacyAccount)
                }
            }

            return imported
        }

        // Algo25: derive the key, then check whether the wallet already holds
        // this address before persisting the account.
        const { seedKey, address } = await createAlgo25Key({ mnemonic })
        await throwIfDuplicate(address, seedKey.id)
        return await createAlgo25WalletAccount({
            seed: { seedKeyId: seedKey.id, address },
        })
    }
}
