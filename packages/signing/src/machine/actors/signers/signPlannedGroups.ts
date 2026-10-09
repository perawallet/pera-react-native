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
    findAccountByAddressOn,
    isSameAddress,
    signingKeyOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    transactionPlanners,
    type ChainKeyStore,
    type ChainScope,
    type Signature,
    type SignedTransaction,
    type SigningRequest,
    type TransactionPlanner,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_KEY_DOMAIN } from '../../../constants'
import {
    CannotSignError,
    InvalidSignableDataError,
    SigningError,
} from '../../../pipeline/errors'
import {
    isUnsignedTransactionsData,
    type AnalyzedSignableGroup,
    type SigningResult,
} from '../../../pipeline/types'
import { resolveSignerCredential } from '../../utils/resolveSignerCredential'
import { resolveSigningAccount } from '../../utils/resolveSigningAccount'

export type PlannedSignerInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    scope: ChainScope
    keyStore: Pick<ChainKeyStore, 'sign'>
}

type GroupKey = { keyPairId: string; scheme: SigningRequest['scheme'] }

/** Signs chain-neutral groups through their chain's planner (see docs/ARCHITECTURE.md). */
export const signPlannedGroups = async ({
    groups,
    allAccounts,
    scope,
    keyStore,
}: PlannedSignerInput): Promise<SigningResult[]> => {
    const planner = transactionPlanners.get(scope.chainId)

    // The key dispatch chose this group's custody from, so the two agree on
    // who signs, a rekey included.
    const keyOf = (group: AnalyzedSignableGroup): GroupKey => {
        const signer = findAccountByAddressOn(
            allAccounts,
            scope.chainId,
            group.signerAddress,
        )
        if (!signer) {
            throw new CannotSignError(group.signerAddress, 'not in this wallet')
        }
        const account = resolveSigningAccount(
            signer,
            group.source,
            'transactions',
            allAccounts,
            scope.chainId,
        )
        if (account.custody.kind !== 'local') {
            throw new CannotSignError(group.signerAddress, 'no local key')
        }
        const { scheme } = resolveSignerCredential(account, scope.chainId)
        const keyPairId = signingKeyOn(account, scope.chainId)
        if (!keyPairId) {
            throw new CannotSignError(
                group.signerAddress,
                'no key on this chain',
            )
        }
        return { keyPairId, scheme }
    }

    const signTransaction = async (
        transaction: UnsignedTransaction,
        group: AnalyzedSignableGroup,
        key: GroupKey,
    ): Promise<SignedTransaction> => {
        const requests = planOrRefuse(planner, transaction)
        // Checked before any signature, so a refusal signs nothing. The planner
        // can't recover a signer from a signature, so the key must be exact.
        for (const request of requests) {
            if (
                !isSameAddress(
                    scope.chainId,
                    request.signer,
                    group.signerAddress,
                )
            ) {
                throw new InvalidSignableDataError(
                    'a planned signature is for another account than the one reviewed',
                )
            }
            if (request.scheme !== key.scheme) {
                throw new CannotSignError(
                    group.signerAddress,
                    `no ${request.scheme} key on this chain`,
                )
            }
        }
        const signatures: Signature[] = []
        for (const request of requests) {
            signatures.push({
                requestIndex: request.requestIndex,
                signer: request.signer,
                scheme: request.scheme,
                bytes: await keyStore.sign(
                    key.keyPairId,
                    request.payload,
                    SIGNING_KEY_DOMAIN,
                ),
            })
        }
        return assembleOrRefuse(planner, transaction, signatures)
    }

    const results: SigningResult[] = []
    for (const group of groups) {
        if (
            group.data.type !== 'transactions' ||
            !isUnsignedTransactionsData(group.data)
        ) {
            throw new InvalidSignableDataError(
                'only chain-neutral transactions are signed through a planner',
            )
        }
        const key = keyOf(group)
        const signed: SignedTransaction[] = []
        for (const transaction of group.data.transactions) {
            signed.push(await signTransaction(transaction, group, key))
        }
        results.push({
            signedData: { type: 'signed-transactions', signed },
            signers: [{ address: group.signerAddress }],
            originalIndices: group.originalIndices,
        })
    }
    return results
}

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

const planOrRefuse = (
    planner: TransactionPlanner,
    transaction: UnsignedTransaction,
): SigningRequest[] => {
    try {
        return planner.plan(transaction)
    } catch (error) {
        throw new InvalidSignableDataError(messageOf(error))
    }
}

// The same signatures assemble the same way, so retrying can't help.
const assembleOrRefuse = (
    planner: TransactionPlanner,
    transaction: UnsignedTransaction,
    signatures: Signature[],
): SignedTransaction => {
    try {
        return planner.assemble(transaction, signatures)
    } catch (error) {
        throw new SigningError(
            messageOf(error),
            error instanceof Error ? error : undefined,
            { retryable: false },
        )
    }
}
