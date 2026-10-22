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
    chainAccountOf,
    hasCustody,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { withTimeout } from '@perawallet/wallet-core-shared'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    AuthData,
    AuthDataMetadata,
    SigningResult,
    SigningCallbacks,
} from '../types'
import { CannotSignError, HardwareWalletError, SigningError } from '../errors'
import {
    LEDGER_CONNECTION_TIMEOUT_MS,
    LEDGER_CONFIRMATION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { authDataSignerFor, type AuthDataSigner } from '../../message-signer'
import {
    ledgerTimeoutReason,
    withLedgerSession,
    type LedgerSessionOptions,
} from './withLedgerSession'

export type HardwareStrategyOptions = {
    hardwareWalletRegistry?: HardwareWalletRegistry
    /** Read at auth-data sign time, for the signer / rekey cross-check. */
    getAllAccounts: () => WalletAccount[]
    /** The chain the device signs for; the account's address there is the one verified. */
    chainId: ChainId
}

/** A hardware account and the address it signs for on the request's chain. */
type HardwareSigner = {
    account: HardwareWalletAccount
    address: string
}

const toHardwareSigner = (
    account: WalletAccount,
    chainId: ChainId,
): HardwareSigner => {
    const address = chainAccountOf(account, chainId)?.address
    if (!hasCustody(account, 'hardware')) {
        throw new CannotSignError(
            address ?? '',
            'Account is not a hardware wallet',
        )
    }
    if (!address) {
        throw new CannotSignError('', `Account has no address on ${chainId}`)
    }
    return { account, address }
}

type SignAuthDataOnHardwareWalletOptions = LedgerSessionOptions & {
    authDataSigner: AuthDataSigner
    getAllAccounts: () => WalletAccount[]
}

/** Gates on minimum app version and host-side validation before signing. */
const signAuthDataOnHardwareWallet = (
    signer: HardwareSigner,
    authData: AuthData,
    metadata: AuthDataMetadata,
    options: SignAuthDataOnHardwareWalletOptions,
): Promise<Uint8Array> => {
    const { authDataSigner, getAllAccounts, callbacks } = options
    const { accountIndex } = signer.account.custody

    return withLedgerSession(
        signer.account,
        signer.address,
        options,
        async ({ transport, guard }) => {
            // Early version gate — the device-side error is the fallback.
            await withTimeout(
                transport.assertCanSignData(),
                LEDGER_CONNECTION_TIMEOUT_MS,
                'Read Ledger app version',
                ledgerTimeoutReason('Read Ledger app version'),
            )

            authDataSigner.validateAuthData(
                authData,
                metadata,
                getAllAccounts(),
            )

            callbacks?.onSigningStart?.()
            callbacks?.onProgress?.(1, 1)

            const signature = await withTimeout(
                guard.race(
                    transport.signData({
                        accountIndex,
                        data: authData.data,
                        signerPublicKey: authDataSigner.signerPublicKey(
                            signer.address,
                        ),
                        domain: authData.domain,
                        authenticatorData: authData.authenticatorData,
                        requestId: authData.requestId,
                        scope: metadata.scope,
                        encoding: metadata.encoding,
                    }),
                ),
                LEDGER_CONFIRMATION_TIMEOUT_MS,
                'Sign Ledger data',
                ledgerTimeoutReason('Sign Ledger data'),
            )

            callbacks?.onSigningComplete?.()
            return signature
        },
    )
}

/**
 * Signs auth data on a hardware device. Transactions never reach a strategy:
 * the hardware child signs them through their chain's planner.
 */
export const createHardwareStrategy = (
    options: HardwareStrategyOptions,
): SigningStrategy => {
    const { hardwareWalletRegistry, getAllAccounts, chainId } = options

    return {
        canSign: (account: WalletAccount): boolean => {
            return hasCustody(account, 'hardware')
        },

        sign: async (
            group: AnalyzedSignableGroup,
            account: WalletAccount,
            callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            const signer = toHardwareSigner(account, chainId)

            if (group.data.type === 'arbitrary-data') {
                throw new SigningError(
                    'Hardware wallet signing of arbitrary data is not supported',
                    undefined,
                    // Retrying can never succeed — suppress the Retry affordance.
                    { retryable: false },
                )
            }
            if (group.data.type === 'transactions') {
                throw new SigningError(
                    'Hardware wallets sign transactions through their planner',
                    undefined,
                    { retryable: false },
                )
            }
            if (group.data.type !== 'auth-data') {
                throw new HardwareWalletError('unsupported_data_type')
            }

            // Resolved before any Ledger session so a chain with no auth-data
            // signer is refused without a device prompt.
            const authDataSigner = authDataSignerFor(chainId, signer.address)
            const signature = await signAuthDataOnHardwareWallet(
                signer,
                group.data.authData,
                group.data.metadata,
                {
                    registry: hardwareWalletRegistry,
                    chainId,
                    authDataSigner,
                    getAllAccounts,
                    callbacks,
                },
            )
            return {
                signedData: { type: 'auth-data', signature },
                signers: [{ address: signer.address }],
                originalIndices: group.originalIndices,
            }
        },
    }
}
