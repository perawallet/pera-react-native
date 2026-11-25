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

import { getAddress, isAddress } from 'viem'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type {
    ChainScope,
    TransactionRecord,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    guardedPersist,
    logger,
    registerStore,
    type Nullable,
    type Optional,
    type WithPersist,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { fetchEvmContractMetadata } from '../contracts/api/endpoints'
import { knownContractSubtitle, withApprovalSpenderName } from './action'

const STORE_NAME = 'evm-contract-names-store'

// Most counterparties are wallets Pera will never name, so the misses are
// kept as long as the names; a contract Pera starts curating shows within this.
export const CONTRACT_NAME_TTL_MS = 7 * 24 * 60 * 60_000

type ContractProject = {
    /** The project's name; null for a contract Pera doesn't vouch for. */
    name: Nullable<string>
    logoUrl?: string
}

type ContractNameEntry = ContractProject & {
    /** Unix ms. */
    checkedAt: number
}

type EvmContractNamesState = {
    /** Keyed by `{eip155 chain id}:{lowercase address}`. */
    entries: Record<string, ContractNameEntry>
    remember: (projects: Record<string, ContractProject>, now: number) => void
    resetState: () => void
}

// Counterparties come from the account's public history, so they may sit on
// disk, unlike the contracts a dApp asks the user to call.
export const useEvmContractNamesStore: UseBoundStore<
    WithPersist<StoreApi<EvmContractNamesState>, unknown>
> = create<EvmContractNamesState>()(
    guardedPersist(
        set => ({
            entries: {},
            // Expired entries are dropped on every write, so the map holds at
            // most a week of distinct counterparties.
            remember: (projects, now) =>
                set(({ entries }) => ({
                    entries: {
                        ...Object.fromEntries(
                            Object.entries(entries).filter(
                                ([, { checkedAt }]) =>
                                    now - checkedAt < CONTRACT_NAME_TTL_MS,
                            ),
                        ),
                        ...Object.fromEntries(
                            Object.entries(projects).map(([key, project]) => [
                                key,
                                { ...project, checkedAt: now },
                            ]),
                        ),
                    },
                })),
            resetState: () => set({ entries: {} }),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
            version: 1,
            partialize: ({ entries }) => ({ entries }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useEvmContractNamesStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useEvmContractNamesStore.getState().resetState(),
})

const keyOf = (eip155ChainId: number, address: string): string =>
    `${eip155ChainId}:${address}`

/**
 * Lowercase; set on a row the bundled registry left unnamed, or named by its
 * project, whose logo only the backend has. An approval's counterparty is its
 * spender, whose unnamed row may still carry a subtitle.
 */
const askedCounterparty = ({
    kind,
    subtitle,
    projectName,
    counterparty,
}: TransactionSummary): Optional<string> => {
    const isUnnamed =
        (kind === 'approval' ? projectName : subtitle) === undefined
    return (isUnnamed || projectName !== undefined) &&
        counterparty !== undefined &&
        isAddress(counterparty, { strict: false })
        ? counterparty.toLowerCase()
        : undefined
}

const named = (summary: TransactionSummary, name: string): TransactionSummary =>
    summary.kind === 'approval'
        ? withApprovalSpenderName(summary, name)
        : { ...summary, ...knownContractSubtitle({ name }) }

/** Undefined when the lookup failed, which is never cached. */
const lookUpProject = async (
    scope: ChainScope,
    chain: EvmChain,
    address: string,
): Promise<Optional<ContractProject>> => {
    try {
        const metadata = await fetchEvmContractMetadata(
            scope,
            chain,
            getAddress(address),
        )
        if (!metadata) return { name: null }
        const { projectName, projectLogoUrl } = metadata
        return {
            name: projectName,
            ...(projectLogoUrl && { logoUrl: projectLogoUrl }),
        }
    } catch (error) {
        logger.warn('evm history: contract name lookup failed', {
            error,
            chainId: scope.chainId,
        })
        return undefined
    }
}

/**
 * Names each counterparty Pera curates that the bundled registry doesn't, as
 * the bundled names are: by project, and adds the project's logo to either. A
 * bundled name stands, since it also drives decoding. Every counterparty on
 * the page is asked at once, and only when the cache holds no answer younger
 * than `CONTRACT_NAME_TTL_MS`; a failed lookup isn't cached, so the next read asks again.
 */
export const withContractNames = async (
    records: TransactionRecord[],
    scope: ChainScope,
    chain: EvmChain,
): Promise<TransactionRecord[]> => {
    const eip155ChainId = eip155ChainIdOfNetwork(chain, scope.networkId)
    if (eip155ChainId === undefined) return records

    const now = Date.now()
    const { entries, remember } = useEvmContractNamesStore.getState()
    const unasked = [
        ...new Set(
            records.flatMap(({ summary }) => askedCounterparty(summary) ?? []),
        ),
    ].filter(address => {
        const entry = entries[keyOf(eip155ChainId, address)]
        return !entry || now - entry.checkedAt >= CONTRACT_NAME_TTL_MS
    })
    if (unasked.length > 0) {
        const answers = await Promise.all(
            unasked.map(async address => {
                const project = await lookUpProject(scope, chain, address)
                return project
                    ? [[keyOf(eip155ChainId, address), project] as const]
                    : []
            }),
        )
        const answered = answers.flat()
        if (answered.length > 0) remember(Object.fromEntries(answered), now)
    }

    const known = useEvmContractNamesStore.getState().entries
    return records.map(record => {
        const address = askedCounterparty(record.summary)
        const entry = address ? known[keyOf(eip155ChainId, address)] : undefined
        if (!entry?.name) return record
        const summary =
            record.summary.projectName === undefined
                ? named(record.summary, entry.name)
                : record.summary
        return {
            ...record,
            summary: entry.logoUrl
                ? { ...summary, projectLogoUrl: entry.logoUrl }
                : summary,
        }
    })
}
