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
    isMultisigAccount,
    resolveSignerForAccount,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import type {
    SignerResolution,
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

const describeUnsignable = (r: Exclude<SignerResolution, { kind: 'ok' }>) => {
    switch (r.kind) {
        case 'accountNotFound':
            return 'account not found in wallet'
        case 'watch':
            return 'watch accounts cannot sign'
        case 'authMissing':
            return `auth account ${r.authAddress} is not in the wallet`
        case 'authIsWatch':
            return 'auth account is a watch and cannot sign'
        case 'authNoLocalParticipant':
            return 'auth multisig has no signable participant in this wallet'
        case 'noLocalParticipant':
            return 'multisig has no signable participant in this wallet'
    }
}

export const useArc60Signer = (): UseArc60SignerResult => {
    const accounts = useAccountsStore(state => state.accounts)
    const { signDataWithKey } = useKMS()

    const signArc60 = useCallback(
        async (
            account: WalletAccount,
            stdSigData: Arc60StdSigData,
            metadata: Arc60Metadata,
        ): Promise<Uint8Array> => {
            if (metadata.scope !== ARC60_SCOPE_AUTH) {
                throw new Arc60InvalidScopeError(metadata.scope)
            }

            // Resolve to the actual signer FIRST so HW/multisig rejection
            // applies to the auth-chain signer, not the requested account.
            const resolution = resolveSignerForAccount(account, accounts)
            if (resolution.kind !== 'ok') {
                throw new Arc60InvalidSignerError(
                    account.address,
                    describeUnsignable(resolution),
                )
            }
            const signer = resolution.signer

            if (isHardwareWalletAccount(signer)) {
                throw new Arc60InvalidSignerError(
                    account.address,
                    'hardware wallet ARC-60 signing is not supported',
                )
            }
            if (isMultisigAccount(signer)) {
                throw new Arc60InvalidSignerError(
                    account.address,
                    'multisig ARC-60 signing is not supported',
                )
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

            // hdPath validates against the signer's derivation since that's
            // the key actually producing the signature.
            if (isHDWalletAccount(signer)) {
                if (stdSigData.hdPath) {
                    try {
                        assertAlgorandBip44PathMatches(
                            stdSigData.hdPath,
                            signer.hdWalletDetails,
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
            } else if (isAlgo25Account(signer)) {
                if (stdSigData.hdPath) {
                    throw new Arc60FailedHdPathError(
                        stdSigData.hdPath,
                        'Algo25 accounts have no BIP44 derivation path',
                    )
                }
            } else {
                throw new Arc60InvalidSignerError(
                    account.address,
                    `unsupported signer type ${signer.type}`,
                )
            }

            // ARC-60 payload is signed as-is — no MX prefix.
            const [signature] = await signDataWithKey(
                signer.keyPairId,
                SIGNING_KEY_DOMAIN,
                [payload],
            )
            return signature
        },
        [accounts, signDataWithKey],
    )

    return { signArc60 }
}
