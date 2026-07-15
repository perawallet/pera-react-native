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

import type { SigningMachineContext } from '../machine/context'
import {
    isArbitraryDataRequest,
    isArc60Request,
    isTransactionRequest,
} from '../models'
import { isInteractiveSource } from '../pipeline/types'
import { parseArc60ForDisplay } from '../utils/parseArc60ForDisplay'
import type {
    ResolvedSignRequest,
    ResolvedRequestKind,
    SourceKind,
    TransportKind,
} from './types'

const resolveSourceKind = (sourceType: string | undefined): SourceKind =>
    (sourceType ?? 'local') as SourceKind

const resolveTransportKind = (
    context: SigningMachineContext,
): TransportKind => {
    const source = context.signableGroups?.[0]?.source
    if (source?.type === 'multisig-cosign') return 'multisig-cosign'
    if (context.request.transport === 'callback') return 'callback'
    return (context.request.transport ?? 'algod') as TransportKind
}

const resolveKind = (context: SigningMachineContext): ResolvedRequestKind => {
    const req = context.request

    if (isTransactionRequest(req)) {
        const isMultisigCosign =
            req.sourceType === 'multisig-cosign' && !!req.signRequestId
        const cosignSignerAddress = isMultisigCosign
            ? (req.signerOverrides?.get(0) ?? null)
            : null
        return {
            type: 'transactions',
            isMultisigCosign,
            cosignSignerAddress,
            hasMultiple: (req.groupContext ?? req.txs).length > 1,
        }
    }

    if (isArbitraryDataRequest(req)) {
        return {
            type: 'arbitrary-data',
            isSingle: req.data.length === 1,
        }
    }

    if (isArc60Request(req)) {
        return {
            type: 'arc60',
            parsed: parseArc60ForDisplay(
                req.stdSigData.data,
                req.metadata.encoding,
            ),
        }
    }

    throw new Error(
        `buildResolvedSignRequest: unknown request type: ${(req as { type: string }).type}`,
    )
}

export const buildResolvedSignRequest = (
    context: SigningMachineContext,
): ResolvedSignRequest | null => {
    const { signerAddress, allAccounts, groupSignerTypes } = context

    if (!signerAddress || !groupSignerTypes) return null

    const signerType = groupSignerTypes.get(signerAddress)
    if (!signerType) return null

    const signerAccount = allAccounts.find(a => a.address === signerAddress)
    if (!signerAccount) return null

    return {
        signerType,
        signerAccount,
        groupSignerTypes,
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
