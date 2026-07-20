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

// SWAP: PQ-021 replaces this genesis-hash heuristic with a real pqsig-build
// capability probe once an official pqsig-capable node exists. This gate is a
// LocalNet-only stand-in: it declares a node quantum-capable purely because its
// genesis hash is not a known production (mainnet/testnet) hash, NOT because we
// verified it accepts the `pqsig` field. See
// docs/superpowers/specs/2026-07-16-real-quantum-falcon-accounts-design.md.

/**
 * Minimal structural view of the algosdk `Algodv2` surface this gate needs.
 *
 * A local interface (rather than importing `algosdk.Algodv2`) keeps the probe
 * decoupled and — more importantly — avoids pulling `@joe-p/*` / `algosdk`
 * types that the PQ firewall test scopes to the two sanctioned seam files. A
 * real `Algodv2` is structurally assignable to this shape.
 *
 * `genesisHashB64` mirrors what algosdk v3's `versionsCheck().do()` resolves:
 * the `Version` model's `genesisHashB64` field, whose constructor accepts
 * `string | Uint8Array` (the decoded value is typically a `Uint8Array`). Both
 * shapes are normalized to a base64 string before comparison.
 */
export interface GenesisProbeClient {
    versionsCheck(): {
        do(): Promise<{ genesisHashB64?: string | Uint8Array | null }>
    }
}

// Capability decision memoized per resolved genesis-hash string, keyed
// independently of the production list. Module-level so it survives across
// calls within a session.
const capabilityByGenesisHash = new Map<string, boolean>()

// Dedups the network probe so a repeated call on the same client does not hit
// the node twice. The genesis hash is only knowable after probing, so the
// network call is deduped per client here while the capability decision above
// is memoized per resolved hash.
const probeByClient = new WeakMap<GenesisProbeClient, Promise<string | null>>()

/**
 * Normalizes the node's `genesisHashB64` to a base64 string.
 *
 * - `string` is treated as already-base64 and returned verbatim.
 * - `Uint8Array` is base64-encoded.
 * - Empty, missing, or otherwise unusable values resolve to `null`.
 */
const normalizeGenesisHash = (value: unknown): string | null => {
    if (typeof value === 'string') {
        return value.length > 0 ? value : null
    }
    if (value instanceof Uint8Array) {
        return value.length > 0 ? Buffer.from(value).toString('base64') : null
    }
    return null
}

const resolveGenesisHash = (
    algod: GenesisProbeClient,
): Promise<string | null> => {
    const inFlight = probeByClient.get(algod)
    if (inFlight !== undefined) {
        return inFlight
    }
    const probe = algod
        .versionsCheck()
        .do()
        .then(version => normalizeGenesisHash(version?.genesisHashB64))
    probeByClient.set(algod, probe)
    // Allow a failed probe to be retried rather than caching the rejection.
    probe.catch(() => probeByClient.delete(algod))
    return probe
}

/**
 * Probes whether the connected algod node can broadcast quantum (Falcon
 * `pqsig`) transactions.
 *
 * Capable iff the node's genesis hash (base64) is NOT present in
 * `productionGenesisHashesB64`, so a LocalNet / custom net → `true` and
 * mainnet / testnet → `false`. Conservatively returns `false` whenever the
 * probe throws or the genesis hash is missing/empty/undecodable.
 */
export const supportsQuantumBroadcast = async (
    algod: GenesisProbeClient,
    productionGenesisHashesB64: readonly string[],
): Promise<boolean> => {
    let genesisHash: string | null
    try {
        genesisHash = await resolveGenesisHash(algod)
    } catch {
        return false
    }

    if (genesisHash === null) {
        return false
    }

    const cached = capabilityByGenesisHash.get(genesisHash)
    if (cached !== undefined) {
        return cached
    }

    const capable = !productionGenesisHashesB64.includes(genesisHash)
    capabilityByGenesisHash.set(genesisHash, capable)
    return capable
}
