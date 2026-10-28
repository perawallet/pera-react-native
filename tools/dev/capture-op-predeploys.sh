#!/usr/bin/env bash
# tools/dev/capture-op-predeploys.sh
# Capture the OP-stack fee oracle (GasPriceOracle and L1Block predeploys, their
# proxies and implementations) from a live OP-stack chain at a pinned block, and
# write it as the EVM conformance suite's Base fixture. Anvil --optimism ships
# neither contract, and the suite runs offline, so the real contracts are
# vendored and installed with anvil_setCode/anvil_setStorageAt. The live
# oracle's own readings at that block are recorded too, so the suite can prove
# the installed copy prices exactly as Base Sepolia did.
# Re-capturing at a past block needs an archive-capable RPC.
#
# Usage: tools/dev/capture-op-predeploys.sh <https-rpc-url> <block-number> [out-file]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOUNDRY_IMAGE="ghcr.io/foundry-rs/foundry:v1.5.1@sha256:3a70bfa9bd2c732a767bb60d12c8770b40e8f9b6cca28efc4b12b1be81c7f28e"
DEFAULT_OUT="${SCRIPT_DIR}/../../conformance-evm/src/vectors/opStackPredeploys.ts"

GAS_PRICE_ORACLE=0x420000000000000000000000000000000000000F
L1_BLOCK=0x4200000000000000000000000000000000000015

# Below and above the oracle's minimum transaction size, so both the clamp and
# the compressed-size path of getL1Fee are pinned.
SMALL_SAMPLE=0x02f86c
LARGE_SAMPLE="0x$(for i in $(seq 0 255); do printf '%02x' "$i"; done)"
OPERATOR_FEE_GAS=21000

usage() {
  echo "Usage: tools/dev/capture-op-predeploys.sh <https-rpc-url> <block-number> [out-file]" >&2
  exit 1
}

[ "$#" -ge 2 ] && [ "$#" -le 3 ] || usage
RPC_URL="$1"
BLOCK="$2"
OUT="${3:-$DEFAULT_OUT}"
[[ "$RPC_URL" =~ ^https://[A-Za-z0-9._/:-]+$ ]] || {
  echo "ERROR: the RPC URL must be https://" >&2
  exit 1
}
[[ "$BLOCK" =~ ^[0-9]+$ ]] || {
  echo "ERROR: the block must be a decimal block number" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is required and its daemon must be running." >&2
  exit 1
fi

# One container for every read: each `cast` would otherwise pay a container start.
# Proxies keep the implementation's state in their own storage; the EIP-1967
# slots hold the implementation and admin. Slots 0-15 cover every field the
# oracle and L1Block declare; zero slots are left out because Anvil reads them as zero.
# shellcheck disable=SC2016
CAPTURE='
set -eu
rpc="$1"; block="$2"; small="$3"; large="$4"; gas="$5"; shift 5
if [ "$(cast chain-id --rpc-url "$rpc")" != 84532 ]; then
  echo "ERROR: $rpc is not Base Sepolia (chain id 84532)" >&2
  exit 1
fi
eip1967_impl=0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
eip1967_admin=0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103
zero=0x0000000000000000000000000000000000000000000000000000000000000000
dump() {
  addr="$1"
  echo "code $addr $(cast code "$addr" --block "$block" --rpc-url "$rpc")"
  for slot in $(seq 0 15) "$eip1967_impl" "$eip1967_admin"; do
    key=$(cast to-uint256 "$slot")
    value=$(cast storage "$addr" "$key" --block "$block" --rpc-url "$rpc")
    [ "$value" = "$zero" ] || echo "slot $addr $key $value"
  done
}
for proxy in "$@"; do
  echo "proxy $proxy"
  dump "$proxy"
  impl=$(cast implementation "$proxy" --block "$block" --rpc-url "$rpc")
  echo "impl $proxy $impl"
  dump "$impl"
done
gpo="$1"
read_oracle() {
  cast call --block "$block" --rpc-url "$rpc" -- "$gpo" "$@"
}
for reading in l1BaseFee blobBaseFee baseFeeScalar blobBaseFeeScalar; do
  echo "reading $reading $(read_oracle "$reading()")"
done
for sample in "$small" "$large"; do
  echo "l1fee $sample $(read_oracle "getL1Fee(bytes)" "$sample")"
done
echo "operatorfee $gas $(read_oracle "getOperatorFee(uint256)" "$gas")"
'

RAW="$(docker run --rm --entrypoint sh "$FOUNDRY_IMAGE" -c "$CAPTURE" sh \
  "$RPC_URL" "$BLOCK" "$SMALL_SAMPLE" "$LARGE_SAMPLE" "$OPERATOR_FEE_GAS" \
  "$GAS_PRICE_ORACLE" "$L1_BLOCK")"

# shellcheck disable=SC2016
printf '%s\n' "$RAW" | node -e '
const [rpcUrl, block, out] = process.argv.slice(1)
const lines = require("fs").readFileSync(0, "utf8").trim().split("\n")
const accounts = []
const byAddress = new Map()
const account = address => {
  const key = address.toLowerCase()
  if (!byAddress.has(key)) {
    const entry = { address, code: "", storage: [] }
    byAddress.set(key, entry)
    accounts.push(entry)
  }
  return byAddress.get(key)
}
const readings = {}
const l1Fees = []
let operatorFee
// The lint rule wants groups of three from five digits up, and none below.
const grouped = value => {
  const digits = value.toString()
  return digits.length < 5 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, "_")
}
const amount = hex => {
  if (!/^0x[0-9a-f]{64}$/.test(hex)) throw new Error(`unexpected oracle reading ${hex}`)
  return `${grouped(BigInt(hex))}n`
}
for (const line of lines) {
  const [kind, address, a, b] = line.split(" ")
  if (kind === "code") account(address).code = a
  if (kind === "slot") account(address).storage.push([a, b])
  if (kind === "reading") readings[address] = amount(a)
  if (kind === "l1fee") l1Fees.push({ data: address, fee: amount(a) })
  if (kind === "operatorfee") operatorFee = { gasUsed: `${grouped(BigInt(address))}n`, fee: amount(a) }
}
const names = ["l1BaseFee", "blobBaseFee", "baseFeeScalar", "blobBaseFeeScalar"]
if (names.some(name => readings[name] === undefined) || l1Fees.length !== 2 || operatorFee === undefined) {
  throw new Error("the capture returned no oracle readings")
}
for (const { address, code } of accounts) {
  if (!/^0x[0-9a-f]+$/.test(code) || code === "0x") {
    throw new Error(`${address} has no code at block ${block}`)
  }
}
const host = new URL(rpcUrl).host
const header = `/*
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
`
const body = accounts
  .map(({ address, code, storage }) => {
    const slots = storage
      .map(([slot, value]) => `            [\n                \x27${slot}\x27,\n                \x27${value}\x27,\n            ],\n`)
      .join("")
    return `    {\n        address: \x27${address}\x27,\n        code: \x27${code}\x27,\n        storage: [${slots === "" ? "" : `\n${slots}        `}],\n    },\n`
  })
  .join("")
const text = `${header}
import type { Address, Hex } from \x27viem\x27

export type PredeployAccount = {
    address: Address
    code: Hex
    /** Non-zero slots only, as [slot, value] 32-byte words. */
    storage: readonly (readonly [Hex, Hex])[]
}

export type OracleReadings = {
    l1BaseFee: bigint
    blobBaseFee: bigint
    baseFeeScalar: bigint
    blobBaseFeeScalar: bigint
    /** In wei, for each sample of transaction bytes. */
    l1Fees: readonly { data: Hex; fee: bigint }[]
    /** In wei, for \`gasUsed\` gas. */
    operatorFee: { gasUsed: bigint; fee: bigint }
}

// Generated by tools/dev/capture-op-predeploys.sh from Base Sepolia (${host}) at block ${block}: the
// GasPriceOracle and L1Block proxies with their implementations, so the oracle prices with real parameters offline.

export const OP_STACK_PREDEPLOYS: readonly PredeployAccount[] = [
${body}]

// What the live oracle answered at the same block; a slot the capture missed
// would make the installed copy answer differently.
export const OP_STACK_ORACLE_READINGS: OracleReadings = {
${names.map(name => `    ${name}: ${readings[name]},\n`).join("")}    l1Fees: [
${l1Fees.map(({ data, fee }) => `        {\n            data: \x27${data}\x27,\n            fee: ${fee},\n        },\n`).join("")}    ],
    operatorFee: {
        gasUsed: ${operatorFee.gasUsed},
        fee: ${operatorFee.fee},
    },
}
`
require("fs").writeFileSync(out, text)
' "$RPC_URL" "$BLOCK" "$OUT"

echo "Wrote ${OUT}" >&2
