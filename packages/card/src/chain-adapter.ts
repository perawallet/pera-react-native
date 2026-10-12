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
    type ChainId,
    type ChainScope,
    type PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { CardSignInData } from './api/card-creation'
import type { PendingWithdrawal } from './models'

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
    /** Sign-in payload whose message carries the delegation token's nonce. */
    signData: CardSignInData
    /** Base64 signature over the sign-in payload. */
    signature: string
    /** Single-use token from GET /v1/delegation/token. */
    token: string
}

export type EscrowWithdrawalParams = {
    scope: ChainScope
    sender: string
    cardAddress: string
    /** Base units of the card's settlement asset. */
    amount: bigint
}

export type CardManualDepositBuildParams = {
    sender: string
    cardAddress: string
    /** Base units of the settlement asset. */
    amount: bigint
}

export type CardFundingSourceEligibility = {
    /**
     * The chain's card contract can draw from the account, and it holds a key
     * (local or hardware) of the scheme the card's proofs are signed with.
     * Watch and multisig accounts never qualify.
     */
    canFund: boolean
    /** The account can sign the sign-in proof card creation needs. */
    canProveOwnership: boolean
    /** The account can sign the delegation auto-draw needs. */
    canAutoDraw: boolean
}

/** The account can't cover the fee and keep its minimum balance. */
export type CardChainErrorReason = 'insufficient-native-balance'

export type CardAutoDrawOperations = {
    /**
     * Registers the signed delegation with Baanx, then switches auto-draw on
     * chain. The on-chain leg is fee-sponsored, so the funding account needs
     * none of the native asset. Resolves without submitting when already on.
     */
    enableAutoDraw(
        account: WalletAccount,
        cardAddress: string,
        scope: ChainScope,
    ): Promise<void>
    /** Resolves without submitting when already off. */
    disableAutoDraw(account: WalletAccount, scope: ChainScope): Promise<void>
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
        scope: ChainScope,
        ownerAddress: string,
    ): Promise<Nullable<PendingWithdrawal>>
    /** Seconds a request must age before release; null until the contract owner sets it. */
    getWaitTimeSeconds(scope: ChainScope): Promise<Nullable<number>>
}

/** The chain-specific legs of the card flows; registered by the chain package. */
export interface CardChainAdapter {
    chainId: ChainId
    /** Settlement asset (USDC) id, or null when the scope has none. */
    settlementAsset(scope: ChainScope): Nullable<string>
    delegationApprovalRequest(
        params: DelegationApprovalParams,
    ): CardDelegationRequest
    /** Base units held; 0 when the account cannot hold the asset yet. */
    getAssetBalance(
        scope: ChainScope,
        address: string,
        assetId: string,
    ): Promise<bigint>
    /** Resolves once the transaction is in a block. */
    awaitConfirmation(scope: ChainScope, txId: string): Promise<void>
    /**
     * A transfer of the settlement asset to the card's own account.
     * @throws CardEscrowNotConfiguredError when the scope has no settlement asset.
     */
    buildManualDeposit(
        params: CardManualDepositBuildParams,
        scope: ChainScope,
    ): Promise<PeraTransaction[]>
    fundingSourceEligibility(
        account: WalletAccount,
        scope: ChainScope,
    ): CardFundingSourceEligibility
    /** Null for anything the chain can't name more precisely than the caller's copy. */
    describeError(error: unknown): Nullable<CardChainErrorReason>
    /**
     * Explorer link for a card transaction leg. Null when Baanx's `legNetwork`
     * isn't this chain or the scope has no explorer.
     */
    transactionUrl(
        hash: string,
        legNetwork: string,
        scope: ChainScope,
    ): Nullable<string>
    useAutoDraw(): CardAutoDrawOperations
    withdrawal: CardEscrowWithdrawals
}

export const cardChainAdapters =
    createChainAdapterRegistry<CardChainAdapter>('card')

export const cardAdapterFor = (scope: ChainScope): CardChainAdapter =>
    cardChainAdapters.get(scope.chainId)
