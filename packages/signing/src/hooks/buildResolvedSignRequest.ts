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

import { findAccountByAddressOn } from '@perawallet/wallet-core-accounts'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'
import type { SigningMachineContext } from '../machine/context'
import {
    isArbitraryDataRequest,
    isAuthDataRequest,
    isMessageRequest,
    isTransactionRequest,
    reviewGroupOf,
} from '../models'
import { isInteractiveSource } from '../pipeline/types'
import { messageSignerChainAdapters } from '../message-signer'
import type {
    ResolvedSignRequest,
    ResolvedRequestKind,
    SourceKind,
    TransportKind,
} from './types'
import { chainIdOfSignRequest } from '../models/chain'

const resolveSourceKind = (sourceType: Optional<string>): SourceKind =>
    (sourceType ?? 'local') as SourceKind

const resolveTransportKind = (
    context: SigningMachineContext,
): TransportKind => {
    const source = context.signableGroups?.[0]?.source
    if (source?.type === 'multisig-cosign') return 'multisig-cosign'
    if (context.request.transport === 'callback') return 'callback'
    // Submitted through the chain's broadcaster like a `network` request; only
    // the caller's answer differs.
    if (context.request.transport === 'submit-and-answer') return 'network'
    return (context.request.transport ?? 'network') as TransportKind
}

const resolveKind = (context: SigningMachineContext): ResolvedRequestKind => {
    const req = context.request

    if (isTransactionRequest(req)) {
        const group = reviewGroupOf(req)
        const isMultisigCosign =
            req.sourceType === 'multisig-cosign' && !!req.signRequestId
        const cosignSignerAddress = isMultisigCosign
            ? (group.signerOverrides?.get(0) ?? null)
            : null
        return {
            type: 'transactions',
            isMultisigCosign,
            cosignSignerAddress,
            hasMultiple: group.transactions.length > 1,
        }
    }

    if (isArbitraryDataRequest(req)) {
        return {
            type: 'arbitrary-data',
            isSingle: req.data.length === 1,
        }
    }

    if (isAuthDataRequest(req)) {
        const chainId = chainIdOfSignRequest(req)
        const authData = messageSignerChainAdapters.get(chainId).authData
        return {
            type: 'auth-data',
            parsed: authData
                ? authData.parseAuthDataForDisplay(
                      req.authData.data,
                      req.metadata.encoding,
                  )
                : {
                      type: 'error',
                      message: `chain ${chainId} has no auth-data signer`,
                  },
        }
    }

    if (isMessageRequest(req)) {
        return {
            type: 'message',
            summary: messageSignerChainAdapters
                .get(chainIdOfSignRequest(req))
                .describe(req.message),
        }
    }

    throw new Error(
        `buildResolvedSignRequest: unknown request type: ${(req as { type: string }).type}`,
    )
}

export const buildResolvedSignRequest = (
    context: SigningMachineContext,
): Nullable<ResolvedSignRequest> => {
    const { signerAddress, allAccounts, groupSigners } = context

    if (!signerAddress || !groupSigners) return null

    const signerType = groupSigners.get(signerAddress)?.custody
    if (!signerType) return null

    const signerAccount = findAccountByAddressOn(
        allAccounts,
        context.deps.scope.chainId,
        signerAddress,
    )
    if (!signerAccount) return null

    return {
        signerType,
        signerAccount,
        groupSigners,
        source: {
            kind: resolveSourceKind(context.request.sourceType),
            isInteractive: isInteractiveSource(context.request.sourceType),
        },
        transport: { kind: resolveTransportKind(context) },
        kind: resolveKind(context),
        // Default — the live actor's child snapshot is layered on top by
        // useSigningPipeline. Callers using buildResolvedSignRequest in
        // isolation (e.g. unit tests against context only) see `null`.
        activeChild: null,
    }
}
