# Multi-chain architecture

The target architecture for supporting chains beyond Algorand. It defines the boundaries and the
rules that keep them; it is not a description of what is implemented. The path from the current code
to this shape is `docs/MULTI_CHAIN_MIGRATION.md`.

The goal is that adding a chain is implementing chain-specific logic and nothing else. Two things
have to be true for that: shared code must never learn a chain's name, and a chain's SDK must never
be reachable from shared code.

## Package topology

```
packages/blockchain     Chain-agnostic. Types, chain registry, capabilities, adapter ports.
                        No runtime chain SDK dependency.

packages/algorand       The only package permitted to import algosdk or algokit-utils.
                        Implements the ports for family 'algorand'. Depends on blockchain.

packages/evm            viem. Implements the same ports for family 'evm'. Depends on blockchain.

packages/accounts       Depend on packages/blockchain only. Chain packages are supplied at
packages/assets         the composition root and never imported directly.
packages/transactions
packages/signing
packages/database
```

The arrow direction is the whole design: **`@perawallet/wallet-core-blockchain` must not know that
`@perawallet/wallet-core-algorand` exists, at any point, including during the migration.** The
dependency runs `algorand → blockchain` only. Adapters register themselves into the chain registry at
the composition roots (`apps/mobile`, `apps/browser`). Nothing in the shared layer imports a chain
package, and no chain package imports another.

How the extraction reaches that shape without ever creating a cycle is in
`docs/MULTI_CHAIN_MIGRATION.md`.

An ESLint `no-restricted-imports` rule enforces the SDK boundary. `pqLibraryFirewall.spec.ts` in
`packages/blockchain/src/pq/__tests__` is the same idea at smaller scope, confining the forked algosdk
to a single adapter, and is the working precedent for the pattern.

One exception stands: `packages/blockchain/src/models/index.ts` aliases algosdk's transaction
types (`PeraTransaction`, `PeraDisplayableTransaction` and their kin), and those aliases are reached
from dozens of files in every layer through `wallet-core-blockchain`. They cannot move to the
Algorand package without dragging the network store and schema with them. `blockchain` therefore
keeps a type-only algosdk dependency, confined to that one file, until the Algorand display model is
retired by the deferred vertical migration. Narrowing the signing pipeline's input to
`UnsignedTransaction` does not retire it; the display model is the larger consumer.

### Chain config is not product config

Chain endpoints (node URLs, genesis identifiers, explorers) belong to chain config, resolved per
`ChainScope`. Endpoints for Algorand-only commercial services belong to that product's own
configuration, resolved per `Network`. A single struct holding both resolves on one argument, so every
field in it, including fields belonging to products that exist on exactly one chain, has to be
answerable for any chain the wallet supports.

Endpoints are configuration, not descriptor data. They are set per build from environment variables
through `tools/generate-config.sh`, and the `custom` network's endpoints come from the custom-network
store at runtime rather than from anything static. A descriptor holding an `endpoints` table would
duplicate the first and cannot express the second. The descriptor holds what is intrinsic to a chain;
`getChainConfig(scope)` holds where this build talks to it.

## Chain identity

```ts
type ChainFamily = 'algorand' | 'evm' | 'utxo'
type ChainId = 'algorand' | 'ethereum' | 'base' | 'polygon'

type ChainScope = { chainId: ChainId; network: Network }
type ChainScopeKey = `${ChainId}:${Network}`
```

`Network` is the existing type from `packages/config/src/models/network.ts`, with its four values:
`mainnet`, `testnet`, `betanet` and `custom`. It is not redefined. `betanet` and `custom` are
Algorand developer networks, and each descriptor declares which networks it supports, so an EVM
descriptor lists `mainnet` and `testnet` and the registry's per-network listing returns Algorand alone
for the other two. That is how the developer networks keep working without every chain having to
answer for them.

Chain and network are separate axes. The active network stays a single global toggle; which chains
are enabled is a per-account choice. A `ChainScope` is the product of the two, and every chain-scoped
function takes one rather than a bare `Network`.

`ChainScopeKey` is also what the database stores (see Storage), so its encoding is a storage format:
the separator is `:` and never changes.

CAIP-2 identifiers (`eip155:8453`) are held on the descriptor rather than derived at call sites, so
the registry generates the mapping in both directions and WalletConnect namespaces need no
hand-maintained translation table.

## Descriptors are data, adapters are behaviour

```ts
type ChainDescriptor = {
    id: ChainId
    family: ChainFamily
    displayName: string
    supportedNetworks: readonly Network[]
    caip2: Partial<Record<Network, string>>
    nativeAsset: {
        assetId: string
        symbol: string
        name: string
        decimals: number
    }
    signing: {
        schemes: SigningScheme[]
        derivationPaths: Partial<Record<SigningScheme, string>>
    }
    capabilities: ChainCapabilities
    explorer: {
        txUrl(id: string, network: Network): string
        addressUrl(addr: string, network: Network): string
    }
    finality: { confirmations: number }
}
```

A descriptor lives in its chain's package, not in `blockchain`: it is chain-specific data, and the
shared layer must not know Algorand exists. A descriptor must never be asked about a network it did
not declare.

Adapters are registered per family, not per chain, which is what makes the cost of a new chain
predictable:

| Adding                            | Cost                             |
| --------------------------------- | -------------------------------- |
| Base, Polygon, Arbitrum, Optimism | one descriptor entry, no code    |
| Solana, Bitcoin                   | one family adapter, plus entries |

`signing.schemes` is a set, not a single value: Algorand accepts both Ed25519 and Falcon-1024
signatures, so a chain that declared one scheme could not represent it.

## Capabilities

```ts
type ChainCapabilities = {
    requiresAssetOptIn: boolean
    hasMinimumBalance: boolean
    supportsRekey: boolean
    supportsAtomicGroups: boolean
    supportsNativeMultisig: boolean
    hasTokenApproval: boolean
    hasAccountNonce: boolean
    supportsReplacement: boolean
    multipleAddressesPerAccount: boolean
    feeModel: 'flat' | 'gas' | 'rate'
    assetKinds: readonly AssetKind[]
}
```

Shared code branches on capabilities, never on `chainId` or `family`. A `switch` on chain family
inside `blockchain`, `accounts`, `assets`, `transactions` or `signing` means a capability is missing;
add the capability instead. A literal chain id in those packages is the same failure in a quieter
form. A scope comes from the account's enabled chains, from an asset's `AssetRef`, or from the caller,
never from a default written into shared code. Both rules are greppable, which is what makes them
hold up in review. Packages that are Algorand products (`asa-inbox`, `nfd`, `card`, `staking`,
`swaps`) may name their chain; they are not shared code.

## Ports

Six narrow interfaces rather than one adapter object, because they differ in lifetime and in how they
are faked in tests.

```ts
interface AddressCodec {
    derive(publicKey: Uint8Array, opts: DeriveOpts): string
    validate(addr: string): boolean
    normalize(addr: string): string
    areEqual(a: string, b: string): boolean
    toPaymentUri(addr: string, opts?: PaymentUriOpts): string
}

interface ChainDataSource {
    getAccountState(addr: string, scope: ChainScope): Promise<AccountState>
    getHoldings(
        addr: string,
        scope: ChainScope,
        page?: PageRef,
    ): Promise<Page<Holding>>
    getAssetMetadata(
        refs: AssetRef[],
        scope: ChainScope,
    ): Promise<AssetMetadata[]>
    getPrices(refs: AssetRef[], scope: ChainScope): Promise<AssetPrice[]>
    getTransactionHistory(
        addr: string,
        scope: ChainScope,
        page?: PageRef,
    ): Promise<Page<TransactionRecord>>
    getFeeEstimate(
        draft: UnsignedTransaction,
        scope: ChainScope,
    ): Promise<FeeEstimate>
    shouldSync(
        addrs: string[],
        scope: ChainScope,
        since?: SyncCursor,
    ): Promise<{ sync: boolean; cursor: SyncCursor }>
}

interface TransactionBuilder {
    build(
        intent: TransactionIntent,
        ctx: BuildContext,
    ): Promise<UnsignedTransaction>
}

interface TransactionDecoder {
    decode(
        raw: Uint8Array | string,
        scope: ChainScope,
    ): Promise<UnsignedTransaction>
    summarize(txn: UnsignedTransaction): TransactionSummary
}

interface Broadcaster {
    submit(signed: SignedTransaction[], scope: ChainScope): Promise<string[]>
    waitForConfirmation(
        id: string,
        scope: ChainScope,
    ): Promise<TransactionReceipt>
}

interface SignaturePlanner {
    plan(txn: UnsignedTransaction): SigningRequest[]
    assemble(txn: UnsignedTransaction, sigs: Signature[]): SignedTransaction
}
```

`normalize` and `areEqual` exist because address equality is not string equality: EVM addresses carry
an EIP-55 mixed-case checksum and Algorand addresses are uppercase base32. Comparing addresses with
`===` is a correctness bug on any chain with a case-insensitive or checksummed representation.

`toPaymentUri` is on the codec because the receive screen must not know URI formats: Algorand uses its
own URI scheme and EVM uses EIP-681 `ethereum:` URIs, and the QR code and share sheet render whatever
the codec returns.

`ChainDataSource` is deliberately the only place external data plumbing appears. An adapter is free
to satisfy it from a node, a first-party backend, a third-party indexer, or a mix, and changing that
choice is invisible above the port. Two consequences:

- `shouldSync` is how the Pera `should-refresh` endpoint stays an Algorand implementation detail. The
  sync loop asks every scope the same question; the Algorand adapter answers from the backend, an EVM
  adapter from `eth_blockNumber` or an indexer cursor. No other family waits on an Algorand backend.
- An indexer is not optional on EVM. No RPC method enumerates which ERC-20s or NFTs an address holds,
  so a raw-RPC adapter could only discover tokens from a curated allowlist. The vendor sits behind the
  port, so replacing it, or moving to a Pera EVM backend, changes no call site.

Choosing the EVM RPC and indexer vendors is a recorded decision, not an implementation detail: direct
client requests ship an API key in the binary, a proxy means backend work, and the indexer either
supplies prices or a separate price source is needed. The decision belongs in this document when it
is made.

## Transactions

```ts
type UnsignedTransaction = {
    chainId: ChainId
    network: Network
    /** Chain-native object. Opaque above the adapter layer. */
    payload: unknown
    /** Chain-agnostic and renderable. What shared UI reads. */
    summary: TransactionSummary
    chainData: ChainTransactionData
}
```

Shared UI renders `summary`; only the owning adapter touches `payload`. `UnsignedTransaction` is the
type that replaces `PeraTransaction` as the load-bearing transaction type in the signing pipeline.

```ts
type TransactionSummary = {
    kind:
        | 'transfer'
        | 'token-transfer'
        | 'nft-transfer'
        | 'contract-call'
        | 'swap'
        | 'chain-specific'
    /** i18n key and parameters, produced by the adapter. */
    title: { key: string; params?: Record<string, string> }
    direction: 'in' | 'out' | 'self' | 'none'
    counterparty?: string
    amount?: { assetRef: AssetRef; value: Decimal }
    icon: TransactionIconKind
}
```

The adapter produces the display strings rather than the UI selecting them, so a list row renders
"opted in to USDC" and "approved Uniswap" through the same component without knowing which chain
produced either.

`AssetRef` carries a `chainId`. Algorand uses `'0'` as the native asset's id (`ALGO_ASSET_ID` in
`@perawallet/wallet-core-shared`), and a second chain with the same sentinel would collide with it in
every asset-keyed map and table unless the chain is part of the key.

### How much of the display is shared

Three tiers, and only the third is chain-specific:

| Tier         | Shared?        | Why                                                                   |
| ------------ | -------------- | --------------------------------------------------------------------- |
| List row     | Yes            | Renders `summary` alone; the adapter supplies every string            |
| Detail spine | Yes            | Status, fee, timestamp, participants, identifier, explorer link       |
| Detail body  | No, per-family | Opt-in, key registration, heartbeat and approval have no shared shape |

A per-family detail component is chain-specific code in the UI layer, which is where chain-specific
code belongs. Confining it there is the abstraction working, not failing: the alternative is those
concepts leaking into `accounts`, `assets` and `signing`, which is what the capability rule exists to
prevent.

`apps/mobile/src/modules/transactions/components/TransactionDisplay` already dispatches on Algorand
transaction type to per-type components over shared chrome. A family registry adds one dispatch level
above that and leaves its contents alone.

Adapters live in `packages/` and emit i18n keys that live in `apps/mobile`, which is a contract across
the layer boundary. A test must assert that every key an adapter can emit exists in the catalogue, or
a chain nobody exercises by hand ships with missing strings.

### Never present a transaction you cannot explain

A transaction whose effect cannot be decoded is shown as an unrecognised interaction with its raw
call, and claims nothing about what it does.

The asymmetry that makes this a rule rather than a preference: an Algorand application call declares
its asset movements in the group, so a reviewer can see the effect without understanding the
application. An EVM `approve(spender, 2^256-1)` is indistinguishable from an innocuous contract call
and grants permanent unlimited spend of a token. Approvals, `setApprovalForAll`, and EIP-712 payloads
of Permit shape each need their own warning keyed on recognising them; generic struct rendering
presents a drain as a signature request.

### Two entry paths, both required

```
wallet UI  ──▶ TransactionIntent ──▶ Builder ──┐
                                               ├──▶ UnsignedTransaction ──▶ Planner ──▶ Broadcaster
dApp / WC  ──▶ raw payload       ──▶ Decoder ──┘
```

An intent abstraction alone cannot express an arbitrary contract call handed over by a connected
dApp, so the decoder path is not redundant with the builder path. Both produce the same
`UnsignedTransaction`, which is why everything downstream of them is chain-agnostic.

### Signatures are plural

`SignaturePlanner.plan()` returns a list. One signature per transaction is a special case, not the
model:

| Case                  | Signatures              |
| --------------------- | ----------------------- |
| EVM transaction       | one                     |
| Algorand atomic group | one per group member    |
| Algorand multisig     | M of N over one payload |
| UTXO transaction      | **one per input**       |

Algorand multisig already requires M-of-N, so the plural shape costs nothing beyond what is already
owed, and it is the difference between UTXO being an adapter and UTXO being a rewrite.

### Hashing and prefixing are the planner's job

`keyStore.sign` applies no prefix and bypasses the upstream tag guard, so whatever a chain requires
before the bytes reach the key is applied deliberately by that family's planner: keccak256 of the RLP
typed transaction, the `\x19Ethereum Signed Message:\n` prefix for `personal_sign`, the EIP-712 domain
separator. Nothing may assume it happened elsewhere. The Algorand equivalent, `sourceType: 'local'`
auto-approving and discarding rekey and close warnings, is re-verified per family rather than
inherited.

## Keys

Signing strategies are selected on **scheme × custody**, read from the account's credentials, not on
account type. Ledger makes the reason concrete: it has separate Algorand and Ethereum device apps, so
`ed25519+ledger` and `secp256k1+ledger` are different code paths, while `secp256k1+local` is one path
shared by every EVM chain.

secp256k1 derivation and ECDSA signing live inside the keystore backends (core, web, react-native),
never in JavaScript. The keystore's whole purpose is that seeds and private keys do not reach JS
memory; deriving with a JS BIP32 library in `packages/kms` would move the seed out to get a key back.
The keystore packages declare a secp256k1 curve option in their types without implementing it, so this
is upstream work and the longest-lead item on the EVM path.

The input to that derivation is the stored BIP-39 entropy, not the HD root. The keystore stores a
wallet's root as a BIP32-Ed25519 key already derived from the seed, with the raw entropy in a separate
child. BIP32 secp256k1 needs the 64-byte BIP-39 seed, so the path is entropy → mnemonic → seed →
child, all inside the keystore. It is the same seed MetaMask and Ledger's Ethereum app derive from, so
a Pera mnemonic yields the same EVM address in either, and the known-answer tests pin that. A
derivation bug here produces addresses whose funds cannot be recovered.

## Accounts

An account is a chain-agnostic identity. Addresses hang off it; it is not itself bound to a chain.

```ts
type WalletAccount = {
    id: string
    name?: string
    credentials: AccountCredential[]
    enabledChains: ChainId[]
    addresses: Partial<Record<ChainScopeKey, string>>
    chainState?: Partial<Record<ChainScopeKey, AccountChainStateMirror>>
}

type AccountCredential =
    | {
          kind: 'local'
          scheme: SigningScheme
          keyPairId: string
          hdPath?: string
      }
    | {
          kind: 'hardware'
          scheme: SigningScheme
          device: HardwareRef
          accountIndex: number
      }
    | {
          kind: 'multisig'
          scheme: SigningScheme
          threshold: number
          members: string[]
          version: number
      }
    | { kind: 'watch' }
```

Existing accounts get `enabledChains: ['algorand']`; every other chain is an explicit opt-in, and no
key material or address is derived for a chain until the user enables it.

### Why credentials replace a single account type

A single account-type enum answers three independent questions at once, where a signature comes from,
which cryptography produces it, and how the key material was obtained, which is why a chain axis
cannot be added to it without the categories colliding.

| Custody     | Scheme       | Provenance |
| ----------- | ------------ | ---------- |
| `local`     | `ed25519`    | `hd`       |
| `hardware`  | `secp256k1`  | `imported` |
| `composite` | `falcon1024` | `device`   |
| `none`      |              |            |

`type` survives as a derived label, computed from credentials on hydration and never persisted, so the
many UI files that read `account.type` keep working while nothing depends on the stored value.

One physical Ledger holds two credentials, not one: its Algorand app derives Ed25519 and its Ethereum
app derives secp256k1. Enabling an EVM chain on a Ledger account therefore depends on which device
apps are installed, and the credential list is where that becomes visible before signing time rather
than during it. Talking to the Ethereum app is its own project, so a hardware account is Algorand-only
until then, by the eligibility predicate below rather than by a special case.

### Chain eligibility

> An account may enable a chain if and only if it holds a credential whose scheme appears in that
> chain's `signing.schemes`.

This is the only coupling between accounts and chains, and it makes several rules fall out rather
than needing to be enforced:

- A raw-seed Ed25519 Algorand account has no BIP32 path and therefore no secp256k1 key to derive. It
  is permanently Algorand-only, by the predicate rather than by a check someone has to remember.
- A Falcon account is eligible for Algorand, because Algorand lists `falcon1024`, and for nothing
  else.
- Only an account with a BIP-39 seed can mint an additional credential on demand, which is what makes
  it the sole genuinely multi-chain account kind.

Watch accounts invert the predicate: holding no credential, their eligibility follows from whether a
family can parse the stored address.

### Native multisig is family-specific

Algorand multisig is an address-level construct: a threshold and a public key list hash to an
address. A smart contract wallet is a deployed contract with its own address derivation and its own
signing flow. They present a similar M-of-N experience and share no mechanics, so they are separate
credential kinds gated by `supportsNativeMultisig`. Unifying them under one concept produces an
abstraction that fits neither.

## Chain-specific data

**Chain-specific data rides in a discriminated union keyed by family. It is never an optional field
on a shared type.**

```ts
type AccountChainStateMirror =
    | {
          family: 'algorand'
          authAddress?: string
          minBalance: Decimal
          status: AccountStatus
      }
    | { family: 'evm'; nonce: number }
    | { family: 'utxo'; nextReceiveIndex: number; nextChangeIndex: number }
```

An optional Algorand field hung off a shared account or transaction type is invisible to the type
system and costs nothing to add, which is precisely how a chain-agnostic model quietly re-acquires
the shape of one chain.

### Three kinds of per-chain data, three owners

| Data                                     | Owner                   | Home                         |
| ---------------------------------------- | ----------------------- | ---------------------------- |
| Derivation and device metadata           | User; fixed at creation | `AccountCredential`          |
| Enabled chains                           | User; mutable           | `WalletAccount`              |
| Auth address, nonce, address gap indices | The chain; self-healing | `chainState` mirror + DB row |

The third row is a cache, not account data. The database row is the source of truth; the mirror
exists because signer resolution and transaction building need these values synchronously, and it is
keyed by scope so there is no ambient "active network" copy to fall out of date between a network
switch and the next sync.

The mirror is not an Algorand accommodation: building an EVM transaction needs the next nonce with
pending transactions accounted for, which is the same problem.

### Keys are scoped, not chain-keyed

Addresses key on `ChainScope`, not `ChainId`. For Algorand and EVM an address is identical across
mainnet and testnet, which makes `ChainId` look sufficient. It is not: Bitcoin testnet uses a
different bech32 prefix, so one key yields a different address string per network. The Algorand
address is therefore written under every network the Algorand descriptor supports, including
`betanet` and `custom`, or a lookup on a developer network comes back empty.

## Storage

The chain scope is stored in the existing `network` column as a `ChainScopeKey`. Every
chain-scoped table (`account_asset_holdings`, `account_balances`, `account_transactions`,
`transactions`, `assets_node`, `assets_pera`, `asset_prices`, `asset_price_misses`, `nfd_cache`,
`submission_attempts`) already carries `network TEXT` in its primary key or as an indexed column.
Widening that column's value from `mainnet` to `algorand:mainnet` scopes every row to a chain without
touching a key.

Why not a `chain_id` column, and how the backfill runs, is in `docs/MULTI_CHAIN_MIGRATION.md`.

`account_address` keeps its name. For a non-Algorand scope it holds that chain's address for the
account.

The Algorand-shaped `account_balances` table (`algo_balance`, `min_balance`, opt-in counts,
`auth_address`) gives way to `account_chain_state`: generic columns plus a `chain_data` JSON column
holding the family variant. JSON is right there because the fields are read by account and scope and
not filtered on, with one exception: if the rekey scans filter on `auth_address`, it stays an indexed
column. `transactions` gains a generic `status` (`pending`, `confirmed`, `failed`, `replaced`), and
its Algorand-only columns move into `chain_data` the same way.

TanStack query keys carry the `ChainScope` for the same reason the rows do, and a bare `Network`
reaching a repository or a query-key builder is a lint error once the migration completes.

## Sync and valuation

The unit of sync work is `(account, ChainScope)`, for every scope in the account's enabled chains
crossed with the networks being synced and filtered by each descriptor's `supportedNetworks`. Each
scope resolves its family's `ChainDataSource` from the registry and writes through the scope-keyed
repositories. Connectivity gating, back-off and the first-tick force-sync keep their semantics per
scope. With only Algorand enabled the fan-out is exactly the current loop.

Fiat is the cross-chain numeraire: account and portfolio totals and balance-sorted account lists
are fiat-denominated, in the user's selected currency. ALGO-denominated values have no meaning for an
account holding ETH on Base and survive only inside the Algorand scope, where staking and swap quotes
still want them. EVM prices flow into `asset_prices` under the EVM scope through `getPrices`, so the
fiat total is computed the same way for every chain.

## Features are gated, not abstracted

Card, staking, swaps, ASA inbox, NFD, ARC-0027, fee delegation, native multisig, Liquid Auth and
mnemonic backup are Algorand products, not chain capabilities with other-chain equivalents. They stay
Algorand-scoped and resolve their availability from chain capabilities, so an account on another
chain never renders them.

Distinguishing the two is the difference between a wallet that supports many chains and a wallet in
which every feature grows a chain check.

## See also

- `docs/ARCHITECTURE.md`: layering of the UI and logic layers
- `docs/MULTI_CHAIN_MIGRATION.md`: how the codebase gets from here to this architecture
- `docs/TESTING.md`: integration harness and MSW handler factories
