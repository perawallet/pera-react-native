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

import { useCallback, useState } from 'react'
import { getSyncService } from '@perawallet/wallet-core-background'
import {
    clearCustomNetworkCache,
    fetchGenesisFromNode,
    getCustomNetworkConfig,
    shouldClearCustomCache,
    useCustomNetworkStore,
    type CustomNetworkConfig,
} from '@perawallet/wallet-core-blockchain'
import { useSwitchNetwork } from '@perawallet/wallet-core-device'
import { Networks } from '@perawallet/wallet-core-shared'
import { useQueryClient } from '@tanstack/react-query'
import { isValidEndpoint } from './isValidEndpoint'

/** Every field as a plain string, including the optional token fields —
 * `PWInput` needs a controlled `string` value, never `undefined`. */
export type CustomNetworkDraft = Record<keyof CustomNetworkConfig, string>

export type CustomNetworkSheetErrors = {
    algodUrl?: boolean
    indexerUrl?: boolean
    genesisHash?: boolean
    /**
     * Required even though signing compares only `genesisHash`: the extension
     * advertises `genesisId` to every dApp over ARC-0027, and
     * `fetchGenesisFromNode` defaults it to `''` when a node omits it — so
     * without this a "valid" config can carry an empty chain name.
     */
    genesisId?: boolean
    /** The most recent "Fetch from node" attempt failed. Informational only
     * — it never blocks manual entry or Save. */
    fetch?: boolean
}

const BLANK_DRAFT: CustomNetworkDraft = {
    algodUrl: '',
    algodToken: '',
    indexerUrl: '',
    indexerToken: '',
    genesisHash: '',
    genesisId: '',
}

const toDraft = (
    config: CustomNetworkConfig | undefined,
): CustomNetworkDraft =>
    config === undefined
        ? { ...BLANK_DRAFT }
        : {
              algodUrl: config.algodUrl,
              algodToken: config.algodToken ?? '',
              indexerUrl: config.indexerUrl,
              indexerToken: config.indexerToken ?? '',
              genesisHash: config.genesisHash,
              genesisId: config.genesisId,
          }

export type UseCustomNetworkSheetResult = {
    draft: CustomNetworkDraft
    errors: CustomNetworkSheetErrors
    isFetching: boolean
    handleFieldChange: (field: keyof CustomNetworkDraft, value: string) => void
    handleFetchGenesis: () => Promise<void>
    handleSave: () => Promise<boolean>
    handleReset: () => void
}

/**
 * A small draft/errors state machine gating one commit point.
 *
 * Every open is a fresh mount by the bottom-sheet manager, so the draft is
 * seeded once by a lazy initializer and every keystroke stays local. There is no
 * `close`: dismissing just unmounts and discards the draft, so no path from
 * "opened the sheet" to "active-but-unconfigured custom network" avoids a
 * validated Save. Android hardware back is swallowed by the manager rather than
 * dismissing, which is how every manager-hosted sheet behaves.
 *
 * `handleSave` is the ONLY writer. It validates both URLs and requires a
 * non-empty genesis hash and id, resolving `false` before touching anything if
 * any fail — the component uses that to keep the sheet open.
 *
 * Both orderings on the success path are load-bearing: clear-before-persist
 * stops an in-flight chain-A query re-inserting rows after the sweep, and
 * persist-before-switch means `custom` is never ACTIVE while unconfigured.
 */
export const useCustomNetworkSheet = (): UseCustomNetworkSheetResult => {
    const [draft, setDraft] = useState<CustomNetworkDraft>(() =>
        toDraft(getCustomNetworkConfig()),
    )
    const [errors, setErrors] = useState<CustomNetworkSheetErrors>({})
    const [isFetching, setIsFetching] = useState(false)
    const { switchNetwork } = useSwitchNetwork()
    const queryClient = useQueryClient()

    const handleFieldChange = useCallback(
        (field: keyof CustomNetworkDraft, value: string) => {
            setDraft(prev => ({ ...prev, [field]: value }))
            if (
                field === 'algodUrl' ||
                field === 'indexerUrl' ||
                field === 'genesisHash' ||
                field === 'genesisId'
            ) {
                setErrors(prev => ({ ...prev, [field]: false }))
            }
        },
        [],
    )

    const handleFetchGenesis = useCallback(async () => {
        if (!isValidEndpoint(draft.algodUrl)) {
            setErrors(prev => ({ ...prev, algodUrl: true }))
            return
        }

        setIsFetching(true)
        setErrors(prev => ({ ...prev, fetch: false }))
        try {
            const fetched = await fetchGenesisFromNode(
                draft.algodUrl,
                draft.algodToken || undefined,
            )
            setDraft(prev => ({
                ...prev,
                genesisHash: fetched.genesisHash,
                genesisId: fetched.genesisId,
            }))
            setErrors(prev => ({
                ...prev,
                fetch: false,
                genesisHash: false,
                genesisId: fetched.genesisId.length === 0,
            }))
        } catch {
            setErrors(prev => ({ ...prev, fetch: true }))
        } finally {
            setIsFetching(false)
        }
    }, [draft.algodUrl, draft.algodToken])

    const handleSave = useCallback(async (): Promise<boolean> => {
        const validationErrors: CustomNetworkSheetErrors = {
            algodUrl: !isValidEndpoint(draft.algodUrl),
            indexerUrl: !isValidEndpoint(draft.indexerUrl),
            genesisHash: draft.genesisHash.length === 0,
            genesisId: draft.genesisId.length === 0,
        }

        if (
            validationErrors.algodUrl ||
            validationErrors.indexerUrl ||
            validationErrors.genesisHash ||
            validationErrors.genesisId
        ) {
            setErrors(prev => ({ ...prev, ...validationErrors }))
            return false
        }

        const next: CustomNetworkConfig = {
            algodUrl: draft.algodUrl,
            algodToken: draft.algodToken || undefined,
            indexerUrl: draft.indexerUrl,
            indexerToken: draft.indexerToken || undefined,
            genesisHash: draft.genesisHash,
            genesisId: draft.genesisId,
        }
        const previous = getCustomNetworkConfig()
        const shouldClear = shouldClearCustomCache(previous, next)

        // Clear BEFORE the store write: `setCustomNetwork` synchronously
        // repoints every ky client, so a chain-A query still in flight could
        // write its rows back after the DELETE and survive under the single
        // `custom` partition. removeQueries evicts the cache but can't undo a DB
        // write. `shouldClear` reads `previous`, so nothing needs the store
        // updated first.
        if (shouldClear) {
            await clearCustomNetworkCache(queryClient)
        }

        useCustomNetworkStore.getState().setCustomNetwork(next)

        await switchNetwork(Networks.custom)
        try {
            const syncService = getSyncService()
            syncService.invalidateQueries()
            syncService.restart()
        } catch {
            // SyncService not yet initialized
        }

        return true
    }, [draft, queryClient, switchNetwork])

    const handleReset = useCallback(() => {
        setDraft({ ...BLANK_DRAFT })
        setErrors({})
    }, [])

    return {
        draft,
        errors,
        isFetching,
        handleFieldChange,
        handleFetchGenesis,
        handleSave,
        handleReset,
    }
}
