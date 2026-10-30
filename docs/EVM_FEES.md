# EVM fees and MAX

How an EVM send is priced, what MAX holds back, and why a small balance is left after it. The code is
in `packages/chain-ethereum/src/transfer/fees.ts` and `builder.ts`, and in the send-funds screens
under `apps/mobile/src/modules/transactions/screens/send-funds/`.

## What each speed prices

Slow, Normal and Fast read the tip at the 10th, 50th and 90th percentile of recent blocks. Each carries
two amounts:

- **Estimated fee**: `gas x (next base fee + tip)`, plus the L1 data and operator fee on an OP-stack
  chain such as Base. This is what the network usually charges.
- **Max fee**: `gas x maxFeePerGas`, where `maxFeePerGas = 2 x next base fee + tip`, plus twice the L1
  surcharge. This is the most the transaction can be charged, and what a balance must cover.

On Ethereum, the 2x base-fee headroom survives about six consecutive full blocks of base-fee growth. A MAX send has
nothing left over to pay a higher fee, so it can never be sped up or replaced; the headroom is the only
thing that gets it mined. The L1 surcharge is priced again by the oracle when the transaction is
broadcast, so it carries the same doubling, and so does the hold a pending send leaves on the balance.

## What MAX reserves

MAX on the native coin offers `balance - sends already in flight - max fee at the selected speed`.

The amount step sizes it at the stored speed, Normal unless an earlier review changed it. The review
re-sizes it to the speed chosen there, so switching speed never leaves a shortfall, nor extra fee unspent.

The review then passes the max fee it showed to the build (`BuildContext.maxFee`). The build keeps
`gas x maxFeePerGas` plus the surcharge headroom inside it, lowering `maxFeePerGas` if the fee rose
since. If the ceiling can't keep one more block of base-fee growth (1/8) over the next block's base fee plus
the tip, it refuses with `fee_above_confirmed` rather than sign a transaction that may sit unmined; the review re-quotes within
its 15 s refetch interval. Every EVM send is capped this way, not only MAX.

## Why a small balance remains

The reserve is a ceiling. The network charges `gas x (base fee + tip)`, so after a MAX send the account
holds about `gas x base fee`, plus the unused part of the L1 headroom on Base. Nothing else is held
back. The amount step says so under the amount.

Halving the headroom would roughly halve that leftover and raise the chance of a send that never mines,
so the headroom is one constant (`BASE_FEE_HEADROOM`) rather than a setting.
