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

// Structural copies of algosdk's transaction and indexer shapes, so this package needs no chain SDK.
// algosdk values assign to them; the way back is `asAlgosdkTransaction` in blockchain.
// chain-algorand's algorand-display-parity.test-d.ts fails when a copy drifts from the SDK.

export type PeraTransactionType =
    | 'payment'
    | 'asset-transfer'
    | 'asset-opt-in'
    | 'asset-opt-out'
    | 'asset-clawback'
    | 'asset-config'
    | 'asset-freeze'
    | 'key-registration'
    | 'app-call'
    | 'state-proof'
    | 'heartbeat'
    | 'unknown'

export type KeyRegType = 'online' | 'offline'

export type AssetTransferType =
    | 'transfer'
    | 'opt-in'
    | 'opt-out'
    | 'clawback'
    | 'unknown'

export type AssetConfigType = 'create' | 'update' | 'destroy'

interface AlgorandAddress {
    readonly publicKey: Uint8Array
    equals(other: AlgorandAddress): boolean
    checksum(): Uint8Array
    toString(): string
}

type AlgorandTransactionTypeCode =
    | 'pay'
    | 'keyreg'
    | 'acfg'
    | 'axfer'
    | 'afrz'
    | 'appl'
    | 'stpf'
    | 'hb'

type AlgorandOnComplete = 0 | 1 | 2 | 3 | 4 | 5

interface TransactionBoxReference {
    readonly appIndex: bigint
    readonly name: Uint8Array
}

interface TransactionHoldingReference {
    readonly assetIndex: bigint
    readonly address: AlgorandAddress
}

interface TransactionLocalsReference {
    readonly appIndex: bigint
    readonly address: AlgorandAddress
}

interface TransactionResourceReference {
    readonly address?: Readonly<AlgorandAddress>
    readonly appIndex?: Readonly<bigint>
    readonly assetIndex?: Readonly<bigint>
    readonly holding?: Readonly<TransactionHoldingReference>
    readonly locals?: Readonly<TransactionLocalsReference>
    readonly box?: Readonly<TransactionBoxReference>
}

interface PaymentTransactionFields {
    readonly receiver: AlgorandAddress
    readonly amount: bigint
    readonly closeRemainderTo?: AlgorandAddress
}

interface KeyRegistrationTransactionFields {
    readonly voteKey?: Uint8Array
    readonly selectionKey?: Uint8Array
    readonly stateProofKey?: Uint8Array
    readonly voteFirst?: bigint
    readonly voteLast?: bigint
    readonly voteKeyDilution?: bigint
    readonly nonParticipation: boolean
}

interface AssetConfigTransactionFields {
    readonly assetIndex: bigint
    readonly total: bigint
    readonly decimals: number
    readonly defaultFrozen: boolean
    readonly manager?: AlgorandAddress
    readonly reserve?: AlgorandAddress
    readonly freeze?: AlgorandAddress
    readonly clawback?: AlgorandAddress
    readonly unitName?: string
    readonly assetName?: string
    readonly assetURL?: string
    readonly assetMetadataHash?: Uint8Array
}

interface AssetTransferTransactionFields {
    readonly assetIndex: bigint
    readonly amount: bigint
    readonly assetSender?: AlgorandAddress
    readonly receiver: AlgorandAddress
    readonly closeRemainderTo?: AlgorandAddress
}

interface AssetFreezeTransactionFields {
    readonly assetIndex: bigint
    readonly freezeAccount: AlgorandAddress
    readonly frozen: boolean
}

interface ApplicationTransactionFields {
    readonly appIndex: bigint
    readonly onComplete: AlgorandOnComplete
    readonly numLocalInts: number
    readonly numLocalByteSlices: number
    readonly numGlobalInts: number
    readonly numGlobalByteSlices: number
    readonly extraPages: number
    readonly approvalProgram: Uint8Array
    readonly clearProgram: Uint8Array
    readonly appArgs: ReadonlyArray<Uint8Array>
    readonly accounts: ReadonlyArray<AlgorandAddress>
    readonly foreignApps: ReadonlyArray<bigint>
    readonly foreignAssets: ReadonlyArray<bigint>
    readonly boxes: ReadonlyArray<TransactionBoxReference>
    readonly access: ReadonlyArray<TransactionResourceReference>
    readonly rejectVersion: number
}

interface HashFactory {
    hashType: number
}

interface MerkleArrayProof {
    path: Uint8Array[]
    hashFactory: HashFactory
    treeDepth: number
}

interface MerkleSignatureVerifier {
    commitment: Uint8Array
    keyLifetime: bigint
}

interface Participant {
    pk: MerkleSignatureVerifier
    weight: bigint
}

interface FalconVerifier {
    publicKey: Uint8Array
}

interface FalconSignatureStruct {
    signature: Uint8Array
    vectorCommitmentIndex: bigint
    proof: MerkleArrayProof
    verifyingKey: FalconVerifier
}

interface SigslotCommit {
    sig: FalconSignatureStruct
    l: bigint
}

interface Reveal {
    sigslot: SigslotCommit
    participant: Participant
}

interface StateProof {
    sigCommit: Uint8Array
    signedWeight: bigint
    sigProofs: MerkleArrayProof
    partProofs: MerkleArrayProof
    merkleSignatureSaltVersion: number
    reveals: Map<bigint, Reveal>
    positionsToReveal: bigint[]
}

interface StateProofMessage {
    blockHeadersCommitment: Uint8Array
    votersCommitment: Uint8Array
    lnProvenWeight: bigint
    firstAttestedRound: bigint
    lastAttestedRound: bigint
}

interface StateProofTransactionFields {
    readonly stateProofType: number
    readonly stateProof?: StateProof
    readonly message?: StateProofMessage
}

interface HeartbeatProof {
    sig: Uint8Array
    pk: Uint8Array
    pk2: Uint8Array
    pk1Sig: Uint8Array
    pk2Sig: Uint8Array
}

interface HeartbeatTransactionFields {
    readonly address: AlgorandAddress
    readonly proof: HeartbeatProof
    readonly seed: Uint8Array
    readonly voteID: Uint8Array
    readonly keyDilution: bigint
    readonly challengeDiscount: boolean
}

interface EncodedSubsig {
    pk: Uint8Array
    s?: Uint8Array
}

interface EncodedMultisig {
    v: number
    thr: number
    subsig: EncodedSubsig[]
}

interface EncodedPQSig {
    sch: Uint8Array
    slt: number
    pk: Uint8Array
    sig: Uint8Array
}

interface LogicSig {
    logic: Uint8Array
    args: Uint8Array[]
    sig?: Uint8Array
    msig?: EncodedMultisig
    lmsig?: EncodedMultisig
    pqsig?: EncodedPQSig
}

// Omits the schema getter and the deprecated raw-secret-key signers: the wallet signs only through the KMS.
export interface PeraTransaction {
    readonly type: AlgorandTransactionTypeCode
    readonly sender: AlgorandAddress
    readonly note: Uint8Array
    readonly lease?: Uint8Array
    readonly rekeyTo?: AlgorandAddress
    group?: Uint8Array
    fee: bigint
    readonly firstValid: bigint
    readonly lastValid: bigint
    readonly genesisID?: string
    readonly genesisHash?: Uint8Array
    readonly payment?: PaymentTransactionFields
    readonly keyreg?: KeyRegistrationTransactionFields
    readonly assetConfig?: AssetConfigTransactionFields
    readonly assetTransfer?: AssetTransferTransactionFields
    readonly assetFreeze?: AssetFreezeTransactionFields
    readonly applicationCall?: ApplicationTransactionFields
    readonly stateProof?: StateProofTransactionFields
    readonly heartbeat?: HeartbeatTransactionFields
    toEncodingData(): Map<string, unknown>
    bytesToSign(): Uint8Array
    toByte(): Uint8Array
    attachSignature(
        signerAddr: string | AlgorandAddress,
        signature: Uint8Array,
    ): Uint8Array
    rawTxID(): Uint8Array
    txID(): string
}

export type PeraTransactionGroup = PeraTransaction[]

export interface PeraSignedTransaction {
    readonly txn: PeraTransaction
    readonly sig?: Uint8Array
    readonly msig?: EncodedMultisig
    readonly lsig?: LogicSig
    readonly pqsig?: EncodedPQSig
    readonly sgnr?: AlgorandAddress
    toEncodingData(): Map<string, unknown>
}

export type PeraSignedTransactionGroup = PeraSignedTransaction[]

export type PeraDisplayableTransaction = IndexerTransaction & {
    roundTimeMillis?: number
    rawTransaction?: PeraTransaction
    /**
     * Count of inner transactions when only the local summary is available
     * (mapped from the SQLite history row). Indexer-fetched transactions
     * carry the full `innerTxns` array instead; prefer it when present.
     */
    innerTransactionCount?: number
}

export type AccountInformation = {
    /** Minimum balance in microAlgos (base units, bigint) */
    minBalance: bigint
    /** Account balance in microAlgos (base units, bigint) */
    amount: bigint
    address: AlgorandAddress
    status: string
    /** Pending rewards in microAlgos (base units, bigint) */
    rewards: bigint
    /** Opted-in assets with amounts in base units (smallest indivisible unit) */
    assets: Array<{ assetId: bigint; amount: bigint; isFrozen: boolean }>
    /** Auth (signer) address when the account is rekeyed; undefined otherwise */
    authAddress?: string
}

export type Arc0001MultisigMetadata = {
    version: number
    threshold: number
    addrs: string[]
}

// Wire shape per ARC-0001 § "Payload: WalletTransaction".
export type Arc0001WalletTransaction = {
    txn: string
    signers?: string[]
    authAddr?: string
    msig?: Arc0001MultisigMetadata
    stxn?: string
    message?: string
    groupMessage?: string
}

export type Arc0001SignTxnsOpts = {
    message?: string
}

export type Arc0001SignTxnsRequest = {
    transactions: Arc0001WalletTransaction[]
    opts?: Arc0001SignTxnsOpts
}

// Multisig is intentionally not modeled — encountering it raises 4200.
export type Arc0001SignerKind =
    | { kind: 'do-not-sign' }
    | { kind: 'single'; address: string }

export type Arc0001ResolvedTransaction = {
    index: number
    walletTxn: Arc0001WalletTransaction
    decoded: PeraTransaction
    sender: string
    signer: Arc0001SignerKind
}

export type Arc0001ResolveResult = {
    // Full request decoded, in order — needed downstream to recompute the
    // group hash, which can't be done over a filtered subset.
    allDecoded: PeraTransaction[]
    toSign: Arc0001ResolvedTransaction[]
    signerOverrides: Map<number, string>
}

export type Arc0001ResolveContext = {
    // Addresses the wallet can sign for. Candidates outside this set are
    // silently skipped (result slot becomes null).
    signableAddresses: Set<string>
    // Optional gate. A candidate in `signableAddresses` but not here is
    // SKIPPED like a third-party sender (never signed for), not named in an
    // error — used by WalletConnect to bind a session to its approved accounts
    // without leaking which other accounts the wallet holds.
    authorizedAddresses?: Set<string>
    // Local multisig addresses. When a transaction's sender is in this set
    // the wallet routes through the multisig propose flow regardless of the
    // ARC-0001 `signers` hint — the dApp can't enumerate our local
    // participants, so we sign with the multisig address itself and let
    // the propose transport collect signatures.
    multisigAddresses?: ReadonlySet<string>
    maxTransactions?: number
}

interface IndexerAddress {
    readonly publicKey: Uint8Array
}

interface IndexerTransaction {
    fee: bigint
    firstValid: bigint
    lastValid: bigint
    sender: string
    applicationTransaction?: IndexerTransactionApplication
    assetConfigTransaction?: IndexerTransactionAssetConfig
    assetFreezeTransaction?: IndexerTransactionAssetFreeze
    assetTransferTransaction?: IndexerTransactionAssetTransfer
    authAddr?: IndexerAddress
    closeRewards?: bigint
    closingAmount?: bigint
    confirmedRound?: bigint
    createdApplicationIndex?: bigint
    createdAssetIndex?: bigint
    genesisHash?: Uint8Array
    genesisId?: string
    globalStateDelta?: IndexerEvalDeltaKeyValue[]
    group?: Uint8Array
    heartbeatTransaction?: IndexerTransactionHeartbeat
    id?: string
    innerTxns?: IndexerTransaction[]
    intraRoundOffset?: number
    keyregTransaction?: IndexerTransactionKeyreg
    lease?: Uint8Array
    localStateDelta?: IndexerAccountStateDelta[]
    logs?: Uint8Array[]
    note?: Uint8Array
    paymentTransaction?: IndexerTransactionPayment
    receiverRewards?: bigint
    rekeyTo?: IndexerAddress
    roundTime?: number
    senderRewards?: bigint
    signature?: IndexerTransactionSignature
    stateProofTransaction?: IndexerTransactionStateProof
    txType?: string
}

interface IndexerAccountStateDelta {
    address: string
    delta: IndexerEvalDeltaKeyValue[]
}

interface IndexerAssetParams {
    creator: string
    decimals: number
    total: bigint
    clawback?: string
    defaultFrozen?: boolean
    freeze?: string
    manager?: string
    metadataHash?: Uint8Array
    name?: string
    nameB64?: Uint8Array
    reserve?: string
    unitName?: string
    unitNameB64?: Uint8Array
    url?: string
    urlB64?: Uint8Array
}

interface IndexerBoxReference {
    app: number
    name: Uint8Array
}

interface IndexerEvalDelta {
    action: number
    bytes?: string
    uint?: bigint
}

interface IndexerEvalDeltaKeyValue {
    key: string
    value: IndexerEvalDelta
}

interface IndexerHashFactory {
    hashType?: number
}

interface IndexerHbProofFields {
    hbPk?: Uint8Array
    hbPk1sig?: Uint8Array
    hbPk2?: Uint8Array
    hbPk2sig?: Uint8Array
    hbSig?: Uint8Array
}

interface IndexerHoldingRef {
    address: IndexerAddress
    asset: number
}

interface IndexerStateProofMessage {
    blockHeadersCommitment?: Uint8Array
    firstAttestedRound?: bigint
    latestAttestedRound?: bigint
    lnProvenWeight?: bigint
    votersCommitment?: Uint8Array
}

interface IndexerLocalsRef {
    address: IndexerAddress
    app: number
}

interface IndexerMerkleArrayProof {
    hashFactory?: IndexerHashFactory
    path?: Uint8Array[]
    treeDepth?: number
}

interface IndexerResourceRef {
    address?: IndexerAddress
    applicationId?: number
    assetId?: number
    box?: IndexerBoxReference
    holding?: IndexerHoldingRef
    local?: IndexerLocalsRef
}

interface IndexerStateProofFields {
    partProofs?: IndexerMerkleArrayProof
    positionsToReveal?: bigint[]
    reveals?: IndexerStateProofReveal[]
    saltVersion?: number
    sigCommit?: Uint8Array
    sigProofs?: IndexerMerkleArrayProof
    signedWeight?: bigint
}

interface IndexerStateProofParticipant {
    verifier?: IndexerStateProofVerifier
    weight?: bigint
}

interface IndexerStateProofReveal {
    participant?: IndexerStateProofParticipant
    position?: bigint
    sigSlot?: IndexerStateProofSigSlot
}

interface IndexerStateProofSignature {
    falconSignature?: Uint8Array
    merkleArrayIndex?: number
    proof?: IndexerMerkleArrayProof
    verifyingKey?: Uint8Array
}

interface IndexerStateProofSigSlot {
    lowerSigWeight?: bigint
    signature?: IndexerStateProofSignature
}

interface IndexerStateProofVerifier {
    commitment?: Uint8Array
    keyLifetime?: bigint
}

interface IndexerStateSchema {
    numByteSlice: number
    numUint: number
}

interface IndexerTransactionApplication {
    applicationId: bigint
    access?: IndexerResourceRef[]
    accounts?: IndexerAddress[]
    applicationArgs?: Uint8Array[]
    approvalProgram?: Uint8Array
    boxReferences?: IndexerBoxReference[]
    clearStateProgram?: Uint8Array
    extraProgramPages?: number
    foreignApps?: bigint[]
    foreignAssets?: bigint[]
    globalStateSchema?: IndexerStateSchema
    localStateSchema?: IndexerStateSchema
    onCompletion?: string
    rejectVersion?: number
}

interface IndexerTransactionAssetConfig {
    assetId?: bigint
    params?: IndexerAssetParams
}

interface IndexerTransactionAssetFreeze {
    address: string
    assetId: bigint
    newFreezeStatus: boolean
}

interface IndexerTransactionAssetTransfer {
    amount: bigint
    assetId: bigint
    receiver: string
    closeAmount?: bigint
    closeTo?: string
    sender?: string
}

interface IndexerTransactionHeartbeat {
    hbAddress: string
    hbKeyDilution: bigint
    hbProof: IndexerHbProofFields
    hbSeed: Uint8Array
    hbVoteId: Uint8Array
    hbChallengeDiscount?: boolean
}

interface IndexerTransactionKeyreg {
    nonParticipation?: boolean
    selectionParticipationKey?: Uint8Array
    stateProofKey?: Uint8Array
    voteFirstValid?: bigint
    voteKeyDilution?: bigint
    voteLastValid?: bigint
    voteParticipationKey?: Uint8Array
}

interface IndexerTransactionPayment {
    amount: bigint
    receiver: string
    closeAmount?: bigint
    closeRemainderTo?: string
}

interface IndexerTransactionSignature {
    logicsig?: IndexerTransactionSignatureLogicsig
    multisig?: IndexerTransactionSignatureMultisig
    pqsig?: IndexerTransactionSignaturePQsig
    sig?: Uint8Array
}

interface IndexerTransactionSignatureLogicsig {
    logic: Uint8Array
    args?: Uint8Array[]
    logicMultisigSignature?: IndexerTransactionSignatureMultisig
    multisigSignature?: IndexerTransactionSignatureMultisig
    pqsig?: IndexerTransactionSignaturePQsig
    signature?: Uint8Array
}

interface IndexerTransactionSignatureMultisig {
    subsignature?: IndexerTransactionSignatureMultisigSubsignature[]
    threshold?: number
    version?: number
}

interface IndexerTransactionSignatureMultisigSubsignature {
    publicKey?: Uint8Array
    signature?: Uint8Array
}

interface IndexerTransactionSignaturePQsig {
    publicKey: Uint8Array
    scheme: string
    signature: Uint8Array
    salt?: number
}

interface IndexerTransactionStateProof {
    message?: IndexerStateProofMessage
    stateProof?: IndexerStateProofFields
    stateProofType?: number
}
