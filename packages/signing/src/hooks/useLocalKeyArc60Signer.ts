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
import {
    assertAlgorandBip44PathMatches,
    canSignArbitraryData,
    InvalidBip44PathError,
    isAlgo25Account,
    isHDWalletAccount,
    isQuantumAccount,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { SIGNING_KEY_DOMAIN } from '../constants'
import type { Arc60Metadata, Arc60StdSigData } from '../pipeline/types'
import {
    Arc60FailedHdPathError,
    Arc60InvalidSignerError,
    buildArc60AuthSigningPayload,
    validateArc60AuthRequest,
} from '../utils/arc60'

export type UseLocalKeyArc60SignerResult = {
    /**
     * Produces a single ARC-60 AUTH-scope signature for the given signer
     * account. Throws spec-aligned errors (`Arc60*Error`) for every rejection
     * path so the caller can surface a precise reason to the dApp.
     */
    signArc60: (
        account: WalletAccount,
        stdSigData: Arc60StdSigData,
        metadata: Arc60Metadata,
    ) => Promise<Uint8Array>
}

// Local-key-only path (Algo25 / HDWallet via KMS). Ledger ARC-60 takes a
// separate route: hardware signer-type dispatch → createHardwareStrategy →
// signArc60OnHardwareWallet, so it never hits this hook.
export const useLocalKeyArc60Signer = (): UseLocalKeyArc60SignerResult => {
    const { signDataWithKey } = useKMS()
    const accounts = useAllAccounts()

    const signArc60 = useCallback(
        async (
            account: WalletAccount,
            stdSigData: Arc60StdSigData,
            metadata: Arc60Metadata,
        ): Promise<Uint8Array> => {
            // ARC-60 verifies signatures against the requested signer's
            // own pubkey. Rekey is NOT followed — sign with this account's
            // own keypair or reject.
            if (!canSignArbitraryData(account)) {
                throw new Arc60InvalidSignerError(
                    account.address,
                    `account ${account.address} cannot sign ARC-60 payloads`,
                )
            }

            // Shared host-side validation (scope / domain / SIWA / signer).
            const { decodedData } = validateArc60AuthRequest(
                stdSigData,
                metadata,
                accounts,
            )

            const payload = buildArc60AuthSigningPayload(
                decodedData,
                stdSigData.authenticatorData,
            )

            if (isHDWalletAccount(account)) {
                if (stdSigData.hdPath) {
                    try {
                        assertAlgorandBip44PathMatches(
                            stdSigData.hdPath,
                            account.hdWalletDetails,
                        )
                    } catch (caught) {
                        if (caught instanceof InvalidBip44PathError) {
                            // Project the generic accounts-package error into
                            // the ARC-60 spec-aligned shape so the dApp gets
                            // `ERROR_FAILED_HD_PATH` semantics.
                            throw new Arc60FailedHdPathError(
                                caught.hdPath,
                                caught.message,
                            )
                        }
                        throw caught
                    }
                }
            } else if (isAlgo25Account(account) || isQuantumAccount(account)) {
                // Neither Algo25 nor quantum accounts are BIP-44 derived, so
                // an hdPath is meaningless for them and is rejected rather
                // than ignored.
                if (stdSigData.hdPath) {
                    throw new Arc60FailedHdPathError(
                        stdSigData.hdPath,
                        `${account.type} accounts have no BIP44 derivation path`,
                    )
                }
            } else {
                // canSignArbitraryData ⇒ hasSigningKeys, which is true for
                // Algo25, HDWallet and quantum; this branch is a defensive
                // type-system fallback for any account type not yet handled
                // above.
                throw new Arc60InvalidSignerError(
                    account.address,
                    `unsupported account type ${account.type}`,
                )
            }

            // ARC-60 payload is signed as-is — no MX prefix.
            const [signature] = await signDataWithKey(
                account.keyPairId,
                SIGNING_KEY_DOMAIN,
                [payload],
            )
            return signature
        },
        // `accounts` backs the rekey-signer cross-check in
        // validateArc60AuthRequest; without it the callback would validate
        // against the account list as of first render and fail open on a
        // rekey revoked after mount.
        [signDataWithKey, accounts],
    )

    return { signArc60 }
}
