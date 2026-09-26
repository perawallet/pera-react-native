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
    createChainAdapterRegistry,
    scopeForLegacyNetwork,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { CardSiwaSignData } from './api/card-creation'
import type { PendingWithdrawal } from './models'

/** The on-chain ids the escrow card flows need, as decimal strings. */
export type EscrowChainConfig = {
    /** Settlement asset id (USDC). */
    assetId: string
    killswitchAppId: string
    /** W3Card (main) application id. */
    mainAppId: string
}

/** A Baanx delegation route and body; the card transport sends it. */
export type CardDelegationRequest = {
    path: string
    data: Record<string, unknown>
}

export type DelegationApprovalParams = {
    /** Delegator (funding-source) address whose spending is being delegated. */
    address: string
    /** Currency code as Baanx expects it, e.g. "usdc". */
    currency: string
    /** Transaction id of the on-chain card creation, from the backend create-card response. */
    txId: string
    /** ARC-60 SIWA sign data whose payload carries the delegation token's nonce. */
    signData: CardSiwaSignData
    /** Base64 ed25519 signature over `sha256(data) || sha256(authData)`. */
    signature: string
    /** Single-use token from GET /v1/delegation/token. */
    token: string
}

export type DelegatorProgramParams = {
    /** Currency code the delegated program covers, as Baanx expects it, e.g. "usdc". */
    currency: string
    /** Delegator (funding-source) address that signed the program. */
    delegatorAddress: string
    /** Base64 encoding of the signed delegation, in the chain's own format. */
    lsigBytes: string
    /** Escrow card address returned by the backend create-card call. */
    cardAddress: string
}

export type EscrowWithdrawalParams = {
    network: Network
    sender: string
    cardAddress: string
    /** Base units of the card's settlement asset. */
    amount: bigint
}

export type AutoDrawToggleParams = {
    network: Network
    sender: string
    /** Settlement asset id as a decimal string. */
    asset: string
}

/** Withdrawal from the escrow card: timelocked, request then release. */
export interface CardEscrowWithdrawals {
    buildRequest(params: EscrowWithdrawalParams): Promise<PeraTransaction[]>
    /**
     * Builds by simulating, so calling it before the wait has elapsed throws
     * the contract's timestamp assert rather than returning a usable group.
     */
    buildWithdraw(params: EscrowWithdrawalParams): Promise<PeraTransaction[]>
    buildCancel(
        params: Omit<EscrowWithdrawalParams, 'amount'>,
    ): Promise<PeraTransaction[]>
    /** The owner's open request, or null when there is none. */
    getPending(
        network: Network,
        ownerAddress: string,
    ): Promise<Nullable<PendingWithdrawal>>
    /** Seconds a request must age before release; null until the contract owner sets it. */
    getWaitTimeSeconds(network: Network): Promise<Nullable<number>>
}

/** The on-chain switch that lets the card draw from the funding account. */
export interface CardAutoDraw {
    /** False until a real switch contract is configured for the network. */
    isConfigured(network: Network): boolean
    /**
     * Built for fee delegation: the sponsor pays, so the returned group
     * carries no fee or group id of its own.
     */
    buildEnable(
        params: AutoDrawToggleParams & { cardAddress: string },
    ): Promise<PeraTransaction[]>
    buildKill(params: AutoDrawToggleParams): Promise<PeraTransaction[]>
    /**
     * Callers MUST check this before enable/kill rather than parse reverts,
     * which surface as opaque simulate failures. An unknown state rethrows
     * instead of reading as disabled.
     */
    isEnabled(params: AutoDrawToggleParams): Promise<boolean>
}

/** The chain-specific legs of the card flows; registered by the chain package. */
export interface CardChainAdapter {
    chainId: ChainId
    /** @throws CardEscrowNotConfiguredError when the build lacks an id. */
    resolveEscrowChainConfig(network: Network): EscrowChainConfig
    /**
     * The pinned AutoDraw program the funding account signs, verified before
     * it is returned.
     * @throws AutoDrawTealUnverifiedError, AutoDrawProgramUnverifiedError
     */
    compileAutoDrawProgram(network: Network): Promise<Uint8Array>
    delegationApprovalRequest(
        params: DelegationApprovalParams,
    ): CardDelegationRequest
    delegatorProgramRequest(
        params: DelegatorProgramParams,
    ): CardDelegationRequest
    /** Base units held; 0 when the account cannot hold the asset yet. */
    getAssetBalance(
        network: Network,
        address: string,
        assetId: string,
    ): Promise<bigint>
    /** Resolves once the transaction is in a block. */
    awaitConfirmation(network: Network, txId: string): Promise<void>
    withdrawal: CardEscrowWithdrawals
    autoDraw: CardAutoDraw
}

export const cardChainAdapters =
    createChainAdapterRegistry<CardChainAdapter>('card')

export const cardAdapterFor = (network: Network): CardChainAdapter =>
    cardChainAdapters.get(scopeForLegacyNetwork(network).chainId)
