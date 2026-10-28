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
    isSameAddress,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    MessageRequest,
    Signature,
    SignedMessage,
} from '@perawallet/wallet-core-chain-contract'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import {
    LEDGER_CONFIRMATION_TIMEOUT_MS,
    LEDGER_CONNECTION_TIMEOUT_MS,
} from '@perawallet/wallet-core-ledger'
import { AppError, withTimeout } from '@perawallet/wallet-core-shared'
import {
    authDataMessageRequest,
    messageSignerFor,
    type MessageSignerChainAdapter,
} from '../../../message-signer'
import {
    CannotSignError,
    InvalidSignableDataError,
} from '../../../pipeline/errors'
import {
    ledgerTimeoutReason,
    throwIfAborted,
    withLedgerSession,
} from '../../../pipeline/signing/withLedgerSession'
import type {
    AnalyzedSignableGroup,
    SignedData,
    SigningCallbacks,
    SigningResult,
} from '../../../pipeline/types'

export type DeviceMessageSigningInput = {
    /** A `message` or `auth-data` group. */
    group: AnalyzedSignableGroup
    /** The signer itself: message signing never follows rekey. */
    account: HardwareWalletAccount
    allAccounts: WalletAccount[]
    scope: ChainScope
    registry?: HardwareWalletRegistry
    callbacks?: SigningCallbacks
}

const messageRequestOf = (
    { data, signerAddress }: AnalyzedSignableGroup,
    scope: ChainScope,
): MessageRequest => {
    if (data.type === 'message') return data.request
    if (data.type === 'auth-data') {
        const { authData, metadata } = data
        return authDataMessageRequest(scope, signerAddress, {
            authData,
            metadata,
        })
    }
    throw new InvalidSignableDataError(
        'only messages and auth data are signed through a message signer',
    )
}

// The chain's refusal is a fact about the payload, so a retry can't change it.
// A typed one (ARC-60's spec errors) keeps its own class and metadata.
const asRefusal = (error: unknown): Error =>
    error instanceof AppError
        ? error
        : new InvalidSignableDataError(
              error instanceof Error ? error.message : String(error),
          )

const assembleOrRefuse = async (
    adapter: MessageSignerChainAdapter,
    request: MessageRequest,
    signatures: Signature[],
): Promise<SignedMessage> => {
    try {
        return await adapter.assemble(request, signatures)
    } catch (error) {
        throw asRefusal(error)
    }
}

/**
 * Signs a message or auth-data group on the account's device: the chain's
 * message signer plans it, the device signs each request's `devicePayload`,
 * and the same signer assembles the answer.
 */
export const signMessageGroupOnDevice = async ({
    group,
    account,
    allAccounts,
    scope,
    registry,
    callbacks,
}: DeviceMessageSigningInput): Promise<SigningResult> => {
    const { chainId } = scope
    const address = chainAccountOf(account, chainId)?.address
    if (!address) {
        throw new CannotSignError('', `Account has no address on ${chainId}`)
    }
    const request = messageRequestOf(group, scope)
    const adapter = messageSignerFor(chainId, request.signer)
    if (!adapter.supports(request.method)) {
        throw new CannotSignError(
            address,
            `unsupported message method ${request.method}`,
        )
    }

    // Planned before the session opens, so a refused message never prompts.
    let plan
    try {
        plan = adapter.plan(request, { account, accounts: allAccounts })
    } catch (error) {
        throw asRefusal(error)
    }
    const requests = plan.map(item => {
        if (!isSameAddress(chainId, item.signer, address)) {
            throw new CannotSignError(
                address,
                'a message must be signed by the account it names',
            )
        }
        const { devicePayload } = item
        if (!devicePayload) {
            throw new InvalidSignableDataError(
                'the message signer gave no bytes for a device to sign',
            )
        }
        return { ...item, devicePayload }
    })

    const signatures = await withLedgerSession(
        account,
        address,
        { registry, callbacks, chainId },
        async ({ transport, guard }) => {
            const { accountIndex } = account.custody
            const signed: Signature[] = []

            if (transport.assertCanSignMessage) {
                await withTimeout(
                    guard.race(transport.assertCanSignMessage()),
                    LEDGER_CONNECTION_TIMEOUT_MS,
                    'Read Ledger app version',
                    ledgerTimeoutReason('Read Ledger app version'),
                )
            }

            callbacks?.onSigningStart?.()
            callbacks?.onProgress?.(1, 1)
            for (const item of requests) {
                throwIfAborted(callbacks?.signal)
                callbacks?.onPhaseChange?.('awaiting-approval')
                const bytes = await withTimeout(
                    guard.race(
                        transport.signMessage(accountIndex, item.devicePayload),
                    ),
                    LEDGER_CONFIRMATION_TIMEOUT_MS,
                    'Sign Ledger message',
                    ledgerTimeoutReason('Sign Ledger message'),
                )
                signed.push({
                    requestIndex: item.requestIndex,
                    signer: item.signer,
                    scheme: item.scheme,
                    bytes,
                })
            }
            callbacks?.onSigningComplete?.()
            return signed
        },
    )

    const message = await assembleOrRefuse(adapter, request, signatures)
    const signedData: SignedData =
        group.data.type === 'auth-data'
            ? { type: 'auth-data', signature: message.signature.bytes }
            : { type: 'message', signed: message }
    return {
        signedData,
        signers: [{ address }],
        originalIndices: group.originalIndices,
    }
}
