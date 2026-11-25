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

/**
 * The µAlgo the sender actually pays into the ARC-59 router: receiver funding
 * plus inbox MBR. This is the amount the payment transaction is built with
 * (buildArc59SendViaInboxTxs), so it is the payment the summary screen must
 * display and balance-check against, beside {@link getArc59MinimumNetworkFee}. `total_protocol_and_mbr_fee` is an
 * independent backend field the signature never uses; displaying/checking
 * that while signing this let a malicious backend hide an overpayment of the
 * whole balance.
 *
 * Intentionally a zero-dependency leaf module (structural param, no imports)
 * so the single source of truth can be shared by the headless signer and the
 * review screen without pulling the schema/endpoint graph into either.
 */
export const getArc59SignedFundingAmount = (summary: {
    algo_fund_amount: number
    minimum_balance_requirement: number
}): bigint =>
    BigInt(summary.algo_fund_amount) +
    BigInt(summary.minimum_balance_requirement)

/**
 * The minimum µAlgo fee for the sender's inbox group. Each outer leg
 * costs at least `senderFee`, and on
 * the router calls one `minFee` per inner transaction they dispatch (the
 * router's opt-in, `inner_tx_count`, and the forwarding payment when the
 * receiver is funded).
 */
export const getArc59MinimumNetworkFee = (
    summary: {
        is_arc59_opted_in: boolean
        inner_tx_count: number
        algo_fund_amount: number
        minimum_balance_requirement: number
    },
    { minFee, senderFee }: { minFee: bigint; senderFee: bigint },
): bigint => {
    const outerLegs =
        2n +
        (getArc59SignedFundingAmount(summary) > 0n ? 1n : 0n) +
        (summary.is_arc59_opted_in ? 0n : 1n)
    const innerTxns =
        BigInt(summary.inner_tx_count) +
        (summary.algo_fund_amount > 0 ? 1n : 0n) +
        (summary.is_arc59_opted_in ? 0n : 1n)
    return outerLegs * senderFee + innerTxns * minFee
}
