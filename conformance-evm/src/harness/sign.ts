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

import { bytesToHex, type Hex } from 'viem'
import type {
    MessageRequest,
    Signature,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { createEvmMessageSignerAdapter } from '@perawallet/wallet-core-chain-ethereum/signing/messages'
import { SIGNING_KEY_DOMAIN } from '@perawallet/wallet-core-signing/constants'
import { signPlannedGroups } from '@perawallet/wallet-core-signing/machine/actors/signers/signPlannedGroups'
import { reviewGroup } from '@perawallet/wallet-core-signing/pipeline/composeAnalysis'
import { reviewerFor } from '@perawallet/wallet-core-signing/pipeline/transactionReviewerBridge'
import type {
    AnalyzedSignableGroup,
    SignableGroup,
} from '@perawallet/wallet-core-signing/pipeline/types'

import type { EvmConformanceAccount } from './accounts'
import type { EvmConformanceEnv } from './context'

/**
 * Signs `unsigned` as the signing machine does for a wallet-built send: the
 * chain's reviewer analyses the group (deciding which held addresses sign),
 * then `signPlannedGroups` runs the planner, the keystore and assembly.
 * Returns the exact bytes the app would broadcast.
 */
export const signTransactionWithApp = async (
    env: EvmConformanceEnv,
    account: EvmConformanceAccount,
    unsigned: UnsignedTransaction,
): Promise<Hex> => {
    const allAccounts = [account.walletAccount]
    const group: SignableGroup = {
        data: { type: 'transactions', transactions: [unsigned] },
        source: { type: 'local' },
        signerAddress: account.address,
        originalIndices: [0],
    }
    const analysis = await reviewGroup(reviewerFor(env.scope.chainId), group, {
        scope: env.scope,
        accounts: allAccounts,
    })
    const analyzed: AnalyzedSignableGroup = { ...group, analysis }
    const [result] = await signPlannedGroups({
        groups: [analyzed],
        allAccounts,
        scope: env.scope,
        keyStore: env.kms,
    })
    if (result?.signedData.type !== 'signed-transactions') {
        throw new Error(
            `signPlannedGroups returned ${result?.signedData.type ?? 'nothing'}, not signed transactions`,
        )
    }
    const [signed] = result.signedData.signed
    return bytesToHex(signed.bytes)
}

/**
 * The message signer's own plan, the keystore's signature over each planned
 * digest, and the signer's assembly into the 65-byte `r‖s‖v` a dApp receives.
 */
export const signMessageWithApp = async (
    env: EvmConformanceEnv,
    account: EvmConformanceAccount,
    request: MessageRequest,
): Promise<Hex> => {
    const signer = createEvmMessageSignerAdapter(env.evmChain)
    const requests = signer.plan(request, {
        account: account.walletAccount,
        accounts: [account.walletAccount],
    })
    const signatures: Signature[] = []
    for (const planned of requests) {
        signatures.push({
            requestIndex: planned.requestIndex,
            signer: planned.signer,
            scheme: planned.scheme,
            bytes: await env.kms.sign(
                account.keyPairId,
                planned.payload,
                SIGNING_KEY_DOMAIN,
            ),
        })
    }
    const { signature } = signer.assemble(request, signatures)
    return bytesToHex(signature.bytes)
}
