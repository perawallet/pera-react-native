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

import { useCallback } from 'react'
import {
    assertAlgorandBip44PathMatches,
    InvalidBip44PathError,
    isAlgo25Account,
    isHDWalletAccount,
    isHardwareWalletAccount,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import type {
    Algo25Account,
    HDWalletAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { SIGNING_KEY_DOMAIN } from '../constants'
import type { Arc60Metadata, Arc60StdSigData } from '../pipeline/types'
import {
    ARC60_SCOPE_AUTH,
    Arc60BadJsonError,
    Arc60FailedHdPathError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
    buildArc60AuthSigningPayload,
    decodeArc60Data,
    verifyAuthenticatorDomain,
} from '../utils/arc60'
import { parseSiwa } from '../utils/siwa'

export type UseArc60SignerResult = {
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

export const useArc60Signer = (): UseArc60SignerResult => {
    const accounts = useAccountsStore(state => state.accounts)
    const { getKeyOrThrow, withHDSession, withAlgo25Session } = useKMS()

    const signHd = useCallback(
        async (
            account: HDWalletAccount,
            payload: Uint8Array,
        ): Promise<Uint8Array> => {
            const key = getKeyOrThrow(account.keyPairId)
            return withHDSession(key, SIGNING_KEY_DOMAIN, async session =>
                session.signData(
                    {
                        account: account.hdWalletDetails.account,
                        keyIndex: account.hdWalletDetails.keyIndex,
                        derivationType: account.hdWalletDetails.derivationType,
                    },
                    payload,
                ),
            )
        },
        [getKeyOrThrow, withHDSession],
    )

    const signAlgo25 = useCallback(
        async (
            account: Algo25Account,
            payload: Uint8Array,
        ): Promise<Uint8Array> => {
            const key = getKeyOrThrow(account.keyPairId)
            return withAlgo25Session(key, SIGNING_KEY_DOMAIN, async session =>
                // ARC-60 specifies the signing payload exactly — no MX prefix.
                session.signData(payload),
            )
        },
        [getKeyOrThrow, withAlgo25Session],
    )

    const signArc60 = useCallback(
        async (
            account: WalletAccount,
            stdSigData: Arc60StdSigData,
            metadata: Arc60Metadata,
        ): Promise<Uint8Array> => {
            if (metadata.scope !== ARC60_SCOPE_AUTH) {
                throw new Arc60InvalidScopeError(metadata.scope)
            }

            if (isHardwareWalletAccount(account)) {
                throw new Arc60InvalidSignerError(
                    account.address,
                    'hardware wallet ARC-60 signing is not supported',
                )
            }

            // Rekey: recurse into the auth account and validate hdPath against
            // the *signing* account's actual derivation, not the original.
            if (account.rekeyAddress) {
                const rekeyedAccount = accounts.find(
                    a => a.address === account.rekeyAddress,
                )
                if (!rekeyedAccount) {
                    throw new Arc60InvalidSignerError(
                        account.address,
                        `no rekeyed account found for ${account.rekeyAddress}`,
                    )
                }
                return signArc60(rekeyedAccount, stdSigData, metadata)
            }

            // Domain binding — verify before doing any signing work.
            verifyAuthenticatorDomain(
                stdSigData.domain,
                stdSigData.authenticatorData,
            )

            const decodedData = decodeArc60Data(
                stdSigData.data,
                metadata.encoding,
            )

            // AUTH scope is strict SIWA: parse + canonicalize before signing
            // so the dApp can't slip arbitrary bytes through the AUTH path.
            let jsonString: string
            try {
                jsonString = new TextDecoder('utf-8', { fatal: true }).decode(
                    decodedData,
                )
            } catch (caught) {
                throw new Arc60BadJsonError(
                    'decoded payload is not valid UTF-8',
                    caught instanceof Error ? caught : undefined,
                )
            }
            const siwa = parseSiwa(jsonString)

            if (siwa.domain !== stdSigData.domain) {
                throw new Arc60BadJsonError(
                    `SIWA domain "${siwa.domain}" does not match request domain "${stdSigData.domain}"`,
                )
            }
            if (siwa.account_address !== stdSigData.signer) {
                throw new Arc60InvalidSignerError(
                    stdSigData.signer,
                    `SIWA account_address "${siwa.account_address}" does not match request signer`,
                )
            }

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
                return signHd(account, payload)
            }

            if (isAlgo25Account(account)) {
                if (stdSigData.hdPath) {
                    throw new Arc60FailedHdPathError(
                        stdSigData.hdPath,
                        'Algo25 accounts have no BIP44 derivation path',
                    )
                }
                return signAlgo25(account, payload)
            }

            throw new Arc60InvalidSignerError(
                account.address,
                `unsupported account type ${account.type}`,
            )
        },
        [accounts, signAlgo25, signHd],
    )

    return { signArc60 }
}
