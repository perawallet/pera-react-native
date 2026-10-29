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
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainKeyStore,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { toError } from '@perawallet/wallet-core-shared'
import { signMessages } from '../../../message-signer'
import {
    CannotSignError,
    InvalidSignableDataError,
    PipelineError,
} from '../../../pipeline/errors'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import { signOrReport } from './signPlannedGroups'

export type MessageSignerInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    scope: ChainScope
    keyStore: Pick<ChainKeyStore, 'sign'>
}

export const signMessageGroups = async ({
    groups,
    allAccounts,
    scope,
    keyStore,
}: MessageSignerInput): Promise<SigningResult[]> => {
    const signPayloads = async (
        keyPairId: string,
        payloads: Uint8Array[],
    ): Promise<Uint8Array[]> => {
        const signatures: Uint8Array[] = []
        for (const payload of payloads) {
            signatures.push(await signOrReport(keyStore, keyPairId, payload))
        }
        return signatures
    }

    const results: SigningResult[] = []
    for (const group of groups) {
        if (group.data.type !== 'message') {
            throw new InvalidSignableDataError(
                'only messages are signed through a message signer',
            )
        }
        const account = findAccountByAddressOn(
            allAccounts,
            scope.chainId,
            group.signerAddress,
        )
        if (!account) {
            throw new CannotSignError(
                group.signerAddress,
                'signer account not found in wallet',
            )
        }
        try {
            const [signed] = await signMessages(
                [group.data.request],
                { account, accounts: allAccounts },
                { signPayloads },
            )
            results.push({
                signedData: { type: 'message', signed },
                signers: [{ address: group.signerAddress }],
            })
        } catch (error) {
            if (error instanceof PipelineError) throw error
            // The chain's refusal is a fact about the payload, so a retry can't change it.
            throw new InvalidSignableDataError(toError(error).message)
        }
    }
    return results
}
