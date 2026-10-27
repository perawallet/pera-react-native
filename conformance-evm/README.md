# EVM conformance suite

Vitest suites that run the app's own EVM code (`packages/chain-ethereum` and the signing pipeline it
plugs into) against **real** EVM nodes: six local Anvil nodes, one per chain Pera ships, each on
that chain's testnet chain id. The independent oracle is Foundry's `cast`, never viem, which is the
app's own library.

This is the EVM sibling of [`conformance/`](../conformance/README.md), and follows its practices.
This page states what differs.

Only key custody and the Pera backend are substituted. `src/harness/keystore.ts` runs the
provider's keystore stack (keystore-core, the provider's own secp256k1 shim, the app's kms core)
over the in-memory driver `conformance/` exports. Harness contexts run with no Pera services, so
every call the suite makes reaches a node.

## Why mocks cannot prove this

Every EVM unit spec in the repo talks to MSW, which answers what the test author expects. These
bug classes are invisible to that:

- **Chain-id binding.** A transaction signed for one chain id must be refused by every other
  chain's node, and the reviewer must refuse a chain id other than the scope's. Only a node with
  its own chain id rejects a cross-chain replay (`suites/security/replay.spec.ts`).
- **Signing preimage.** keystore-core signs with RFC 6979 (deterministic nonces, low-s), so the
  app's signed bytes can match `cast mktx` and `cast wallet sign` byte for byte. A wrong preimage or
  a wrong `yParity` fails that parity offline, and the node's own sender recovery confirms it.
- **Node error text.** `toEvmError` classifies rejections by matching node message text. A pattern
  written against strings the test author typed agrees with the author's assumption; only a real
  node's rejection (`suites/errors/rejections.spec.ts`) disagrees when the wording drifts.
- **Contracts the app assumes exist.** `fetchAccountState` reads balances through Multicall3, and
  Base's fee strategy prices the L1 data fee from the OP-stack GasPriceOracle. Plain Anvil has
  neither, so the harness installs the canonical Multicall3 bytecode and the GasPriceOracle and
  L1Block predeploys captured from Base Sepolia (`src/vectors/`), and proves the installed oracle
  prices as the live one did.

## Running

Docker is the only host prerequisite.

```sh
pnpm evmnet                 # start the six Anvil nodes (pulls the digest-pinned Foundry image)
pnpm test:conformance:evm   # from the repo root; on failure it prints every node's logs
pnpm --filter @perawallet/conformance-evm exec vitest run src/suites/fees   # one directory or file
```

| Chain     | Network      | Chain id | Port | Container               |
| --------- | ------------ | -------- | ---- | ----------------------- |
| Ethereum  | Sepolia      | 11155111 | 8545 | `pera_evmnet_ethereum`  |
| Base      | Base Sepolia | 84532    | 8546 | `pera_evmnet_base`      |
| BNB Chain | BSC testnet  | 97       | 8547 | `pera_evmnet_bsc`       |
| Arbitrum  | Arb. Sepolia | 421614   | 8548 | `pera_evmnet_arbitrum`  |
| Avalanche | Fuji         | 43113    | 8549 | `pera_evmnet_avalanche` |
| Polygon   | Amoy         | 80002    | 8550 | `pera_evmnet_polygon`   |

Every scope is a testnet, so nothing the suite signs replays on a mainnet. The testnet tier carries
the mainnet fee strategy, including Polygon's tip floor. Base runs with `--optimism`. Ports bind to
loopback only, because the nodes hold Anvil's well-known dev keys.

`vitest.setup.ts` fails every file fast with `evmnet is not reachable at …` when a node is down, and
with `… is on the wrong network` when a port serves another chain id. After every test it fails
the test that left automine off or a transaction pooled on any node, because that would stall or
race a later file far from the cause.

The Solidity fixtures (`contracts/src/`) are compiled with `forge` in the same pinned image, and
their ABI and bytecode are committed in `contracts/artifacts/`.
`bash tools/dev/evm-contracts.sh build` rewrites them; `check`, which CI runs, fails when the
committed bytecode no longer matches its source.

### Sessions

The app has one wallet: one keystore, one kms and one database, shared by every chain. A session
(`src/harness/context.ts`) is that wallet, installed as the app's singletons. Create one per test
with `createEvmConformanceSession` or `createEvmConformanceEnv`, and reach other chains on the same
wallet with `envFor`. The setup file retires the session after every test, and anything read
through a retired session throws, so a test that forgets to create its own fails instead of reusing
another test's keys and ledger.

### `dist/` dependency

`vitest.config.ts` and `tsconfig.json` alias the packages the suite tests to their `src`, but those
packages import others (the database among them) through their built `dist/`. An unresolvable
import on the first file means a package was never built: run `pnpm run build`. The reasoning is
the same as `conformance/`'s, in [its README](../conformance/README.md#dist-dependency-ci-relevant).

## What runs is app code

| Area                             | The app code under test                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HD derivation and addresses      | `createEvmKeyDerivation(…).deriveAccount`, `ethereumHdPath`, `createEvmAddressCodec`, kms `prepareHDMasterKey`                                                                                               |
| Raw private-key import           | `parseEthereumPrivateKey`, `formatEthereumPrivateKey`, accounts `buildAccount`                                                                                                                               |
| Transaction signing              | `signPlannedGroups` over `createEvmPlannerAdapter` (`plan`, `assemble`), kms `createKmsCore`, the provider's `secp256k1Shim`                                                                                 |
| Review and signer binding        | `readEvmReviewTransaction`, `readEvmTransaction`, `reviewGroup`, `reviewerFor`, `ethereumCallSummary`                                                                                                        |
| Message signing and permits      | `createEvmMessageSignerAdapter`, `personalSignMessageRequest`, `typedDataMessageRequest`, `parseDomainChainId`, `isPermitTypedData`, `spendApprovalOf`                                                       |
| Transfer construction            | `createEvmTransferAdapter` (`build`, `spendableBalance`) for native, ERC-20, ERC-721 and ERC-1155                                                                                                            |
| Fees                             | `readEvmFeePresets`, `readTransferFees`, `toEvmFeeEstimate`                                                                                                                                                  |
| Nonces and replacement           | `allocateEthereumNonce`, `buildEvmReplacement`, `bumpReplacementFee`, `meetsReplacementBump`                                                                                                                 |
| Submission and reconcile         | `createEvmBroadcasterAdapter` (`submit`, `waitForConfirmation`), `submitEthereumTransactions`, `submitAndRecordEthereumTransactions`, `reconcileEthereumSubmissions`                                         |
| Account state and token metadata | `createEthereumAccountStateOps` (`fetchAccountState`, `accountExists`), `readErc20`, accounts `fetchAndPersistAccount`                                                                                       |
| dApp requests                    | `validateEthereumSendTransaction`, `buildEthereumSendTransaction`, `validateEthereumSendCalls`, `prepareEthereumCallBatch`, `startEthereumCallBatch`, `resumeEthereumCallBatches`, `readEthereumCallsStatus` |
| Node access and error mapping    | `createEvmClient`, `checkEvmRpcChainId`, `toEvmError`                                                                                                                                                        |

Harness code may use viem for types and to shape inputs the way a dApp would, never as the side a
result is compared against.

## The three-proof model

Oracle parity, node acceptance and round-trip decode, as
[`conformance/` defines them](../conformance/README.md#the-three-proof-model). What differs:

- **The oracle is `cast`**, run as `docker exec pera_evmnet_ethereum cast …` (`src/harness/cast.ts`),
  with every untrusted value passed as its own argv element. `src/harness/__tests__/cast.spec.ts`
  checks it against published vectors first, so a broken oracle cannot make parity vacuous.
- **Intents are declared independently of the builder.** An `EvmTxnIntent`
  (`src/harness/assert/intent.ts`) states every field, and omission is destructive: no `value`
  asserts 0 wei, no `data` asserts empty calldata. Calldata comes from `cast calldata`, not from the
  app's encoder.
- **`expectEvmConformant` also proves the money moved** (`src/harness/assert/roundTrip.ts`): the
  submitted bytes hash to the transaction, the signature recovers to the sender, the node's copy
  matches the intent, and the sender's balance fell by exactly `value + gasUsed × effectiveGasPrice`,
  plus the OP-stack L1 fee on Base. Anvil charges that fee but leaves `l1Fee` out of the receipt,
  so the harness prices it with the installed GasPriceOracle.

## Reading a diff failure

Diffs come from the same `formatFieldDiff` as `conformance/`; read them as
[its README describes](../conformance/README.md#reading-a-decoded-diff-failure). A `bigint` prints
with a trailing `n`, so `300000n` against `300000` means a `number` leaked in where wei belongs.

## Pinned behaviour

These are app behaviours the suite pins against a real node, each a bug class a mock let through:

- An imported raw private key resolves a signing scheme and signs (`suites/derivation/rawKey.spec.ts`).
- The planner refuses to plan or assemble a payload missing a nonce, a gas limit or a max fee, and
  `assemble` recovers the signer and refuses a signature from any key but the sender's
  (`suites/security/signerBinding.spec.ts`).
- A token whose `name` and `symbol` are `bytes32` (MKR style) is readable
  (`suites/assets/erc20Metadata.spec.ts`).
- A resend of bytes the node already pools, which Anvil refuses as `transaction already imported`,
  counts as already known rather than a rejection, so the ledger row stays open
  (`suites/submission/broadcast.spec.ts`).
- A gas limit below the intrinsic cost classifies as `OUT_OF_GAS`, and Anvil's raw custom-error
  bytes are never shown as a revert reason (`suites/errors/rejections.spec.ts`).

## Known gaps

- **Ledger hardware signing.** It needs a physical transport.
- **Pera backend services** (history, NFT holdings, the token whitelist, prices, block following)
  are not node calls; MSW unit specs own them. With the assets service off, `fetchAccountState`
  returns native-only holdings, because ERC-20 ids come only from the whitelist; the account-state
  suite stubs the whitelist to prove token balances.
- **Other node implementations.** Anvil proves one implementation's behaviour and error text, not
  geth's, reth's, erigon's, Nethermind's or Besu's. Where Anvil differs, the suite pins Anvil:
    - Replacement: Anvil accepts any strictly higher `maxFeePerGas` and ignores the tip. The app
      enforces geth's 10% bump on both fields locally, so the node-side refusal is shown with an
      unchanged max fee.
    - `transaction already imported` is Anvil's phrasing for a pooled resend.
    - A custom error renders as `custom error 0x…`, and a Solidity panic surfaces as
      `REVERTED_WITH_REASON` with text such as `panic: division or modulo by zero (0x12)`, where
      geth gives a bare revert.
- **`RATE_LIMITED`** is exercised with a synthetic local HTTP 429; real providers' bodies vary.
- **Custom errors are not decoded.** The app has no contract ABI, so users see a bare revert with
  no error name or arguments.
- **Base (OP stack) fees on Anvil.**
    - The harness's L1 fee parity is exact only below the oracle's Fjord 100-byte minimum
      transaction size, where the oracle and the node clamp to the same fee. Every transfer the
      app builds is below it; large dApp calldata is not.
    - The captured operator fee is zero, so `getOperatorFee` parity is vacuous.
    - Anvil runs `eth_call` on Base only for a funded caller, so the harness funds the zero
      address; real OP nodes do not need that.
    - The predeploys are pinned to Base Sepolia block 50,996,000. Re-capturing with
      `tools/dev/capture-op-predeploys.sh` at a past block needs an archive RPC.
- **Real L2 execution semantics** beyond the fee oracle (Arbitrum's L1 calldata gas, OP deposits),
  and reorgs and finality depth. Anvil is a single-node L1 simulator.
- **dApp gas.** `validateEthereumSendCalls` drops per-call `gas`, so every `wallet_sendCalls` call
  is estimated. An `eth_sendTransaction` `gas` is signed as given with no ceiling, so a too-low
  value is mined as an out-of-gas revert the user pays for.
- **Typed data with no `domain.chainId` is signed**, as EIP-712 allows, so the signature is not
  bound to a chain. `suites/signing/messages.spec.ts` pins it so a policy change shows.
- **A quiet chain with no tip floor gets a zero tip.** With every fee-history row empty the app
  picks a 0 tip and a max fee of twice the base fee. Anvil mines it; a real low-traffic network may
  not include it promptly.
- **The call-batch resume test detects the end of a run from a logged warning**, because
  `startEthereumCallBatch` offers no deterministic completion signal.

## Troubleshooting

- `evmnet is not reachable at http://127.0.0.1:8545`: Docker isn't running or the nodes aren't up.
  `pnpm evmnet:status`, then `pnpm evmnet`.
- `… is on the wrong network`, or `pnpm evmnet` cannot bind a port: something else is listening
  on 8545 to 8550, often another Anvil or Hardhat node. Stop it, then `pnpm evmnet`.
- Odd chain state, or a test reporting `a test left evmnet dirty`: `pnpm evmnet:reset` recreates
  every node from a fresh chain.
- `committed artifacts drift from the Solidity sources`: a contract under `contracts/src/` changed
  without a rebuild. Run `bash tools/dev/evm-contracts.sh build` and commit the artifacts.
- An unresolvable-import crash on the very first file, rather than a test failure: a package's
  `dist/` is missing. Run `pnpm run build`.
