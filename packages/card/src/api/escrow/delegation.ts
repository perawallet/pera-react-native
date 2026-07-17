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

import { encodeToBase64, type Network } from '@perawallet/wallet-core-shared'
import { compileAutoDrawProgram } from './lsig'
import { postDelegatorLsig } from './endpoints'

export type SubmitAutoDrawDelegationParams = {
    network: Network
    /** Settlement token SYMBOL AB keys the delegation by, e.g. "usdc". */
    token: string
    /** Funding-source (delegator) address that signs the LogicSig. */
    address: string
    /** Escrow card the delegation is bound to. */
    cardAddress: string
    /**
     * Injected signer: signs `"Program" || program` and returns the
     * msgpack-encoded signed delegated LogicSigAccount bytes (keeps the card
     * package signing-agnostic).
     */
    signLsigProgram: (program: Uint8Array) => Promise<Uint8Array>
    signal?: AbortSignal
}

/**
 * Authorizes the AutoDraw delegation for an escrow card: compile the vendored
 * AutoDraw template, sign it, and POST the signed LSig to AB. Shared by
 * onboarding card creation (Auto funding) and the post-onboarding funding-type
 * switch, so the AB LSig contract lives in exactly one place.
 */
export const submitAutoDrawDelegation = async ({
    network,
    token,
    address,
    cardAddress,
    signLsigProgram,
    signal,
}: SubmitAutoDrawDelegationParams): Promise<void> => {
    const program = await compileAutoDrawProgram({ network })
    const lsigBytes = await signLsigProgram(program)
    await postDelegatorLsig({
        network,
        token,
        delegatorAddress: address,
        lsigBytes: encodeToBase64(lsigBytes),
        cardAddress,
        signal,
    })
}
