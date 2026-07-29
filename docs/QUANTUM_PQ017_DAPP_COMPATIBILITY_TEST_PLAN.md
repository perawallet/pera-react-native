# PQ-017 dApp Compatibility Test Plan

## Purpose

PQ-017 (PERA-4490) makes the wallet raise under-priced dApp fees to the
post-quantum minimum for external (WalletConnect / webview) sign requests
involving a quantum signer. This is a QA test plan for validating that
behavior against real dApps. Real-network execution against live dApp
contracts is a **QA follow-up gated on PQ-021** (PERA-4645 — official `pqsig`
libs + node support); today's testing is **LocalNet-first** via the PQ-019
(PERA-4643) submission path where a given dApp's contracts can run there, and
mechanics-only (no live dApp) elsewhere. See
[QUANTUM_PQ_INTEGRATION.md](./QUANTUM_PQ_INTEGRATION.md) for the underlying
seam architecture.

## Behavior Contract

For an external (WC / webview) ARC-0001 sign request:

- **When to raise**: the resolved signer for a signable txn is a quantum
  account AND its dApp-set fee is below
  `max(algod suggestedParams.minFee, remote-config fee_min_txn_fee) × remote-config fee_pq_multiplier`
  (defaults 1000 × 3 = 3000 µAlgo). See `assignMinimumFeesToGroup`
  (`packages/signing/src/pipeline/sources/assignMinimumFeesToGroup.ts`) and the
  shared base-fee logic in `resolveMinFeeForSender`
  (`packages/signing/src/pipeline/sources/minFeeResolver.ts`).
- **Regroup scope**: raising any txn's fee re-groups its **entire** group
  partition with a new `grp` (algosdk `assignGroupID`) — including members
  Pera doesn't sign. Untouched partitions and ungrouped txns keep their
  original object references.
- **ARC-0001 response**: `useEnqueueArc0001SignRequest`
  (`packages/signing/src/hooks/useEnqueueArc0001SignRequest.ts`) returns the
  **modified** group — signed slots carry node-ready `pqsig` bytes for
  quantum signers, unsigned slots stay `null`, same array length/order as the
  request. **dApps must not assume returned bytes match sent bytes.**
- **Monotonic**: fees are only ever raised, never lowered. Groups with no
  quantum signer are returned byte-identical (same references) via a fast
  path that doesn't even fetch suggested params.
- **Keyreg deeplinks**: `useKeyregDeeplink`
  (`apps/mobile/src/hooks/deeplink/handlers/useKeyregDeeplink.ts`) floors the
  built txn's fee the same way — `max(dAppFee, resolvedMin)` — never lowers.
- **Pooled-fee limitation**: each quantum txn is raised to its **own**
  minimum only. Another txn's fee surplus in the same group does **not**
  exempt a quantum txn from being raised (documented as PQ-017 implementation
  note 3 in `assignMinimumFeesToGroup.ts`).
- **Delivery failure**: if the transport can't deliver the adjusted response,
  the pipeline surfaces `walletconnect.request.quantum_fee_delivery_failed`
  (`apps/mobile/src/i18n/locales/en.json`) instead of a generic error.

## Wallet-Side Evidence to Read During Testing

- Review sheet (SigningOverlays) shows an **"Adjusted"** label
  (`transactions.quantum_fee.adjusted_label`) next to the fee row, plus the
  `QuantumFeeExplainer` bottom sheet
  (`apps/mobile/src/modules/transactions/components/QuantumFeeExplainer/`)
  showing original → adjusted amounts (`transactions.quantum_fee.adjusted_*`).
- On delivery failure, the WC error banner reads the
  `quantum_fee_delivery_failed` string, not a generic connection error.
- Reference automated coverage before re-deriving these mechanics manually:
  `packages/signing/src/pipeline/sources/__tests__/assignMinimumFeesToGroup.spec.ts`
  and `apps/mobile/src/__integration__/wc-sign-quantum-fee.test.tsx` already
  exercise the raise/regroup/response contract end to end against a stubbed
  WC v1 connector.

## Test Matrix

Pera currently supports **WalletConnect v1** only (v2 is unimplemented —
tracked separately). Fill in **Status** per manual run.

| dApp / Entry point                 | Flow tested                     | Group shape               | Expected result                                                            | Status |
| ---------------------------------- | ------------------------------- | ------------------------- | -------------------------------------------------------------------------- | ------ |
| Tinyman                            | Swap; add/remove pool liquidity | Atomic group (2-4 txns)   | Quantum leg's fee raised to PQ min, group re-grouped, swap/pool succeeds   |        |
| Pact.fi                            | Swap                            | Atomic group              | Same as above                                                              |        |
| Folks Finance                      | Lend / borrow deposit           | Atomic group, pooled fees | Quantum txn raised to its own min even if a peer txn overpays (limitation) |        |
| Vestige                            | Price-chart-triggered swap      | Atomic group              | Same as Tinyman/Pact                                                       |        |
| AlgoFi (legacy)                    | Any surviving flow              | Atomic group              | Same as above, or clean rejection if the dApp is defunct                   |        |
| Defly (interop)                    | Cross-wallet WC handoff         | Single or atomic          | Fee raise/regroup transparent to the peer wallet                           |        |
| PeraExplorer / Pera Discover dApps | In-app browser sign request     | Single or atomic          | Same contract via webview transport, not just WC                           |        |
| xGov / governance portal           | Vote / proposal txn             | Single txn                | Fee raised if below PQ min; no regroup needed for a single txn             |        |
| WC v1 session (generic)            | Any `algo_signTxn` request      | n/a                       | Session survives a fee-adjusted response; no protocol-level rejection      |        |
| Deeplink `algo_signTxn` / keyreg   | Deeplink-initiated sign         | Single txn (keyreg)       | Fee floored per contract; no regroup (single txn)                          |        |

## Per-dApp Procedure

1. **Mechanics dry run (any network, do this first)**: connect a quantum
   account via WC v1 to a controlled test peer (or reuse the pattern in
   `wc-sign-quantum-fee.test.tsx`) and confirm fee-raise, regroup, and
   null-padded `pqsig` response shape before touching a real dApp.
2. **LocalNet pass, where the dApp's contracts are deployable there**: use
   `pnpm localnet`, then point the app at it via Settings > Developer > Node
   Settings > Custom network, then
   drive the dApp's native flow (swap, pool op, vote, etc.) from a quantum
   account. Cross-check against
   `apps/mobile/src/__integration__/submit-quantum-broadcast.test.tsx` and
   `send-from-quantum.test.tsx` for the expected broadcast-side behavior.
3. **TestNet pass (post-PQ-021 only)**: connect to the live dApp, initiate
   its flow, and confirm either (a) it submits and confirms on-chain, or (b)
   it rejects the modified response — record the dApp's fallback UX for (b)
   as a compatibility gap, not a wallet defect.
4. **Confirm wallet-side evidence** (Adjusted marker, explainer copy,
   delivery-failure string) per the section above before approving.
5. Record the observed **group shape** and whether the result matched the
   contract in the Status column.

## Known Limitations

- **Pooled fees**: a quantum txn is never exempted by a co-member's fee
  surplus — it is always raised to its own minimum. Expect a higher total
  group fee than a same-shape non-quantum group in fee-pooling dApps.
- **Real-network execution is blocked on PQ-021**: no official `pqsig`-capable
  algod ships yet, so TestNet/MainNet rows stay "Blocked — PQ-021" until then.
- **dApps that hash-check returned bytes** against what they sent will reject
  the modified group by design (ARC-0001 doesn't guarantee byte identity) —
  this is a dApp-side compatibility gap to document per dApp, not something
  Pera can avoid without breaking the fee-safety contract.
- Most third-party dApps don't deploy their contracts to LocalNet, so the
  LocalNet pass above is mechanics-only for those integrations until a
  TestNet run is viable.
