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

import type { useCreateAccount } from '@perawallet/wallet-core-accounts'
import type {
    BackupSyncManagerDeps,
    RestoreCloudBackupResult,
    RestoreCloudBackupVariables,
} from '@perawallet/wallet-core-backup'
import type { LocalSigningFunction } from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { FixtureNetwork } from '../network/fixtureNetwork'

export type BenchScaleName = 'S' | 'M' | 'L' | 'XL'

/** The heavy account is account 0: the one large wallet among many small ones. */
export type BenchScale = {
    name: BenchScaleName
    accounts: number
    heavyAccountAssets: number
    assetsPerAccount: number
    heavyAccountTransactions: number
    /** Capped at the chains the build enables. */
    chains: number
}

export type ScenarioGroup =
    | 'startup'
    | 'db'
    | 'sync'
    | 'import'
    | 'backup'
    | 'signing'
    | 'memory'

export type ScenarioContext = {
    network: FixtureNetwork
    signTransactions: LocalSigningFunction
    createHdWalletAccount: ReturnType<
        typeof useCreateAccount
    >['createHdWalletAccount']
    createSingleKeyAccount: ReturnType<
        typeof useCreateAccount
    >['createSingleKeyAccount']
    restoreCloudBackup: (
        variables: RestoreCloudBackupVariables,
    ) => Promise<RestoreCloudBackupResult>
    /** The hook-bound dependencies the backup sync manager is built from. */
    backupSyncDeps: Pick<
        BackupSyncManagerDeps,
        'importAccounts' | 'importContacts' | 'resolveMnemonic' | 'resolveHd'
    >
    resetState: () => Promise<void>
}

export type Scenario<State = unknown> = {
    /** `<group>.<kebab-name>` */
    id: string
    group: ScenarioGroup
    title: string
    scales: readonly BenchScaleName[]
    /** A chain the build must enable; a build without it does not list or run the scenario. */
    requiresChain?: string
    /** Takes minutes; "Run all" leaves it out, and it runs from its own button. */
    isLong?: boolean
    /** Timed runs; defaults to 10. */
    iterations?: number
    /** Untimed runs before the timed ones; defaults to 2. */
    warmup?: number
    setup: (ctx: ScenarioContext, scale: BenchScale) => Promise<State>
    // Method syntax on purpose: it keeps a `Scenario<Specific>` assignable to
    // the `Scenario` the runner takes.
    run(state: State): Promise<void>
    /**
     * Untimed, before every iteration (warm-up included): the reset an
     * iteration needs so it starts from the state it describes. Keep it out of
     * `run`, which is all that is timed.
     */
    beforeEach?(state: State): Promise<void>
    /**
     * Untimed, after every iteration and after the heap peak is read: cleanup,
     * and checks that the iteration did the work it was meant to.
     */
    afterEach?(state: State): Promise<void>
    /** Heap readings a long run took along the way, attached to its result. */
    heapSeries?(state: State): readonly HeapPoint[]
    teardown?(state: State): Promise<void>
}

export type TimingStats = {
    medianMs: number
    p95Ms: number
    minMs: number
    maxMs: number
    meanMs: number
}

export type HeapSample = {
    usedMb: number
    totalMb: number
    allocatedMb?: number
    gcCount?: number
}

/** Allocations and GC count are deltas over the timed iterations. */
export type HeapStats = {
    beforeMb: number
    afterMb: number
    peakMb: number
    allocatedMb?: number
    gcCount?: number
}

/** One heap reading taken during a long run. */
export type HeapPoint = {
    /** Milliseconds since the run began. */
    atMs: number
    usedMb: number
}

export type ScenarioRun = {
    /** `${scenarioId}@${scale}` */
    key: string
    scenarioId: string
    scale: BenchScaleName
    iterations: number
    timing: Nullable<TimingStats>
    heap: Nullable<HeapStats>
    /** Present for long runs that sample the heap over time. */
    heapSeries?: HeapPoint[]
    error?: string
}

export type RunMeta = {
    platform: 'ios' | 'android'
    deviceModel: string
    osVersion: string
    isDevBuild: boolean
    scalesHash: string
    chains: string[]
    startedAt: string
}

export type ResultsFile = {
    version: 1
    meta: RunMeta
    runs: ScenarioRun[]
}

/**
 * `error`: the current run threw. `fixed`: only the baseline threw. Neither is
 * a timing comparison, so neither can read as `same`.
 */
export type Verdict =
    | 'better'
    | 'same'
    | 'worse'
    | 'new'
    | 'missing'
    | 'error'
    | 'fixed'

export type ComparisonRow = {
    key: string
    current: Nullable<ScenarioRun>
    baseline: Nullable<ScenarioRun>
    deltaPct: Nullable<number>
    verdict: Verdict
    heapVerdict: Verdict
}
