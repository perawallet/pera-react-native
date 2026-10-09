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
 * `accounts-store` payloads exactly as each store version persisted them. They
 * are frozen history: written as plain JSON, never built from today's types or
 * helpers, so a model change cannot quietly rewrite what an old install holds.
 * Only the addresses and key ids are filled in, because the keys are minted
 * fresh on LocalNet each run.
 *
 * Any change to `migrateAccountsState`, and any STORE_VERSION bump, adds the
 * payload the outgoing version wrote here.
 */

type HeldKey = { id: string; address: string; keyPairId: string }

export type FixtureAccounts = {
    algo25: HeldKey
    hd: HeldKey
    quantum: HeldKey
    /** An algo25 account rekeyed on LocalNet to `algo25`. */
    rekeyed: HeldKey
    watch: { id: string; address: string }
}

export type PersistedPayload = {
    state: Record<string, unknown>
    version: number
}

export type StoreFixture = {
    name: string
    payload: (accounts: FixtureAccounts) => PersistedPayload
}

// The network the app named LocalNet under: rekeys were recorded per legacy
// network, and a user on LocalNet has the custom network selected.
const NETWORK = 'custom'

const topLevel = (accounts: FixtureAccounts) => ({
    selectedAccountAddress: accounts.algo25.address,
    sortMode: 'manual',
    manualAccountOrder: [
        accounts.algo25.address,
        accounts.hd.address,
        accounts.quantum.address,
        accounts.rekeyed.address,
        accounts.watch.address,
    ],
    launchAccountMode: 'lastUsed',
    launchAccountAddress: null,
})

const HD_DETAILS = { account: 0, change: 0, keyIndex: 0, derivationType: 9 }

/** v0: the legacy `type` and flat details are the whole record. */
const v0Records = (a: FixtureAccounts) => [
    {
        id: a.algo25.id,
        address: a.algo25.address,
        type: 'algo25',
        keyPairId: a.algo25.keyPairId,
        name: 'Main',
    },
    {
        id: a.hd.id,
        address: a.hd.address,
        type: 'hdWallet',
        keyPairId: a.hd.keyPairId,
        hdWalletDetails: HD_DETAILS,
    },
    {
        id: a.quantum.id,
        address: a.quantum.address,
        type: 'quantum',
        keyPairId: a.quantum.keyPairId,
    },
    {
        id: a.rekeyed.id,
        address: a.rekeyed.address,
        type: 'algo25',
        keyPairId: a.rekeyed.keyPairId,
        rekeyAddress: a.algo25.address,
        rekeyAddressByNetwork: { [NETWORK]: a.algo25.address },
    },
    { id: a.watch.id, address: a.watch.address, type: 'watch' },
]

/** v1: v0 plus the `provenance`/`credentials` pair every write derived. */
const v1Records = (a: FixtureAccounts) => [
    {
        id: a.algo25.id,
        address: a.algo25.address,
        type: 'algo25',
        keyPairId: a.algo25.keyPairId,
        name: 'Main',
        provenance: { kind: 'local', seed: 'algo25' },
        credentials: { algorand: { keyPairId: a.algo25.keyPairId } },
    },
    {
        id: a.hd.id,
        address: a.hd.address,
        type: 'hdWallet',
        keyPairId: a.hd.keyPairId,
        hdWalletDetails: HD_DETAILS,
        provenance: { kind: 'local', seed: 'bip39', hd: HD_DETAILS },
        credentials: { algorand: { keyPairId: a.hd.keyPairId } },
    },
    {
        id: a.quantum.id,
        address: a.quantum.address,
        type: 'quantum',
        keyPairId: a.quantum.keyPairId,
        provenance: { kind: 'local', seed: 'quantum' },
        credentials: { algorand: { keyPairId: a.quantum.keyPairId } },
    },
    {
        id: a.rekeyed.id,
        address: a.rekeyed.address,
        type: 'algo25',
        keyPairId: a.rekeyed.keyPairId,
        rekeyAddress: a.algo25.address,
        rekeyAddressByNetwork: { [NETWORK]: a.algo25.address },
        provenance: { kind: 'local', seed: 'algo25' },
        credentials: { algorand: { keyPairId: a.rekeyed.keyPairId } },
    },
    {
        id: a.watch.id,
        address: a.watch.address,
        type: 'watch',
        provenance: { kind: 'watch' },
        credentials: {},
    },
]

/**
 * v2: `custody`/`chains` replace v1's pair, and the legacy `type` and flat
 * details are still written alongside them.
 */
const v2Records = (a: FixtureAccounts) => [
    {
        id: a.algo25.id,
        address: a.algo25.address,
        type: 'algo25',
        keyPairId: a.algo25.keyPairId,
        name: 'Main',
        custody: { kind: 'local', seed: 'algo25' },
        chains: {
            algorand: {
                address: a.algo25.address,
                keyPairId: a.algo25.keyPairId,
            },
        },
    },
    {
        id: a.hd.id,
        address: a.hd.address,
        type: 'hdWallet',
        keyPairId: a.hd.keyPairId,
        hdWalletDetails: HD_DETAILS,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chains: {
            algorand: { address: a.hd.address, keyPairId: a.hd.keyPairId },
        },
    },
    {
        id: a.quantum.id,
        address: a.quantum.address,
        type: 'quantum',
        keyPairId: a.quantum.keyPairId,
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: {
                address: a.quantum.address,
                keyPairId: a.quantum.keyPairId,
            },
        },
    },
    {
        id: a.rekeyed.id,
        address: a.rekeyed.address,
        type: 'algo25',
        keyPairId: a.rekeyed.keyPairId,
        rekeyAddress: a.algo25.address,
        rekeyAddressByNetwork: { [NETWORK]: a.algo25.address },
        custody: { kind: 'local', seed: 'algo25' },
        chains: {
            algorand: {
                address: a.rekeyed.address,
                keyPairId: a.rekeyed.keyPairId,
            },
        },
    },
    {
        id: a.watch.id,
        address: a.watch.address,
        type: 'watch',
        custody: { kind: 'watch' },
        chains: { algorand: { address: a.watch.address } },
    },
]

/**
 * v3 drops `type`. The authority fields stay on the record, in whichever form
 * the writer used, until the migration lifts them.
 */
const v3Records = (
    a: FixtureAccounts,
    authorityFields: Record<string, unknown>,
) => [
    {
        id: a.algo25.id,
        address: a.algo25.address,
        keyPairId: a.algo25.keyPairId,
        name: 'Main',
        custody: { kind: 'local', seed: 'algo25' },
        chains: {
            algorand: {
                address: a.algo25.address,
                keyPairId: a.algo25.keyPairId,
            },
        },
    },
    {
        id: a.hd.id,
        address: a.hd.address,
        keyPairId: a.hd.keyPairId,
        hdWalletDetails: HD_DETAILS,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chains: {
            algorand: { address: a.hd.address, keyPairId: a.hd.keyPairId },
        },
    },
    {
        id: a.quantum.id,
        address: a.quantum.address,
        keyPairId: a.quantum.keyPairId,
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: {
                address: a.quantum.address,
                keyPairId: a.quantum.keyPairId,
            },
        },
    },
    {
        id: a.rekeyed.id,
        address: a.rekeyed.address,
        keyPairId: a.rekeyed.keyPairId,
        ...authorityFields,
        custody: { kind: 'local', seed: 'algo25' },
        chains: {
            algorand: {
                address: a.rekeyed.address,
                keyPairId: a.rekeyed.keyPairId,
            },
        },
    },
    {
        id: a.watch.id,
        address: a.watch.address,
        custody: { kind: 'watch' },
        chains: { algorand: { address: a.watch.address } },
    },
]

/**
 * v4 renames the Algorand-named seed scheme to a seedless custody and holds
 * authorities only in the store's own maps. The legacy address, key and
 * details are still written beside `custody`/`chains`.
 */
const v4Records = (a: FixtureAccounts) => [
    {
        id: a.algo25.id,
        address: a.algo25.address,
        keyPairId: a.algo25.keyPairId,
        name: 'Main',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: a.algo25.address,
                keyPairId: a.algo25.keyPairId,
            },
        },
    },
    {
        id: a.hd.id,
        address: a.hd.address,
        keyPairId: a.hd.keyPairId,
        hdWalletDetails: HD_DETAILS,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chains: {
            algorand: { address: a.hd.address, keyPairId: a.hd.keyPairId },
        },
    },
    {
        id: a.quantum.id,
        address: a.quantum.address,
        keyPairId: a.quantum.keyPairId,
        custody: { kind: 'local', seed: 'quantum' },
        chains: {
            algorand: {
                address: a.quantum.address,
                keyPairId: a.quantum.keyPairId,
            },
        },
    },
    {
        id: a.rekeyed.id,
        address: a.rekeyed.address,
        keyPairId: a.rekeyed.keyPairId,
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: a.rekeyed.address,
                keyPairId: a.rekeyed.keyPairId,
            },
        },
    },
    {
        id: a.watch.id,
        address: a.watch.address,
        custody: { kind: 'watch' },
        chains: { algorand: { address: a.watch.address } },
    },
]

export const STORE_FIXTURES: StoreFixture[] = [
    {
        name: 'v0',
        payload: a => ({
            state: { accounts: v0Records(a), ...topLevel(a) },
            version: 0,
        }),
    },
    {
        name: 'v1',
        payload: a => ({
            state: { accounts: v1Records(a), ...topLevel(a) },
            version: 1,
        }),
    },
    {
        name: 'v2',
        payload: a => ({
            state: { accounts: v2Records(a), ...topLevel(a) },
            version: 2,
        }),
    },
    {
        // What every v3 install wrote before the record fields were removed.
        name: 'v3 with the per-network map',
        payload: a => ({
            state: {
                accounts: v3Records(a, {
                    rekeyAddress: a.algo25.address,
                    rekeyAddressByNetwork: { [NETWORK]: a.algo25.address },
                }),
                ...topLevel(a),
            },
            version: 3,
        }),
    },
    {
        // Account discovery, Ledger verify and the backup migration wrote the
        // scalar alone, which names no network.
        name: 'v3 with a lone scalar',
        payload: a => ({
            state: {
                accounts: v3Records(a, { rekeyAddress: a.algo25.address }),
                ...topLevel(a),
            },
            version: 3,
        }),
    },
    {
        // The last v3 shape: records without the authority fields, which the
        // store's own maps hold instead.
        name: 'v3 with the authority maps',
        payload: a => ({
            state: {
                accounts: v3Records(a, {}),
                ...topLevel(a),
                authorities: {
                    [`algorand/${NETWORK}`]: {
                        [a.rekeyed.address]: a.algo25.address,
                    },
                },
                unscopedAuthorities: {},
            },
            version: 3,
        }),
    },
    {
        name: 'v4',
        payload: a => ({
            state: {
                accounts: v4Records(a),
                ...topLevel(a),
                authorities: {
                    [`algorand/${NETWORK}`]: {
                        [a.rekeyed.address]: a.algo25.address,
                    },
                },
                unscopedAuthorities: {},
            },
            version: 4,
        }),
    },
    {
        // A record held without an id gets a fresh one, and the order entry
        // that named it by address follows it.
        name: 'v4 with a record held without an id',
        payload: a => ({
            state: {
                accounts: v4Records(a).map(record => {
                    if (record.id !== a.watch.id) return record
                    const { id: _id, ...rest } = record
                    return rest
                }),
                ...topLevel(a),
                authorities: {
                    [`algorand/${NETWORK}`]: {
                        [a.rekeyed.address]: a.algo25.address,
                    },
                },
                unscopedAuthorities: {},
            },
            version: 4,
        }),
    },
]
