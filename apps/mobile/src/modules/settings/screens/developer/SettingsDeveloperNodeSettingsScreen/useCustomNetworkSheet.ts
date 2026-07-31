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
     * Required even though `genesisId` is deliberately excluded from the signing
     * comparison (`genesisHash` is the signature-bound identifier): the
     * extension advertises `genesisId` to every dApp over ARC-0027
     * discover/enable, and `fetchGenesisFromNode` defaults it to `''` when a
     * node omits `genesis-id`. Without this, a "valid" saved config can carry an
     * empty chain name.
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
 * Owns the custom-network config sheet end to end, as a small draft/errors
 * state machine gating a single commit point.
 *
 * This hook is only ever called from inside `CustomNetworkSheet`, which is
 * itself only ever mounted by the app's bottom-sheet manager
 * (`@modules/bottom-sheet`) in response to a `request({ contents:
 * <CustomNetworkSheet /> })` call — so every open is a fresh mount, not a
 * toggle of a persistent instance. The draft is seeded once, at mount, via a
 * lazy `useState` initializer that reads whatever is already persisted (or
 * blanks it out for a first-time setup). Every keystroke stays in local
 * draft state — nothing reaches the store until Save. There is no `close`:
 * the manager's `dismiss()` (Cancel button, backdrop, pan-down) just
 * unmounts this component, which discards the draft for free — the store
 * and the active network are untouched either way, so there is no path from
 * "opened the sheet" to "active-but-unconfigured custom network" that
 * doesn't go through a validated Save.
 *
 * Android hardware back is different: this hook used to need a hand-rolled
 * `BackHandler` effect so back behaved exactly like Cancel (closing the
 * sheet) instead of popping the screen behind it. The manager does NOT
 * reproduce that — `useBlockHardwareBackWhileSheetOpen` only swallows
 * `hardwareBackPress` (blocks it from reaching the navigator) while any
 * manager-hosted sheet is open; it never calls `dismiss`. So back now does
 * nothing visible instead of closing the sheet. That is a real behaviour
 * change from the old effect, but it's the same treatment every other
 * manager-hosted sheet in the app already gets, and there is no
 * state-safety difference either way — nothing commits outside `handleSave`
 * regardless of how this component unmounts.
 *
 * `handleSave` is the ONLY place that writes anything: it validates both
 * URLs (shared `isValidEndpoint`) and requires a non-empty genesis hash and
 * genesis id — failing any of them sets the matching error flag and resolves
 * `false` before touching the store, the cache, or the active network. On
 * success it clears the custom-network cache when
 * {@link shouldClearCustomCache} says the chain identity actually changed,
 * THEN persists the whole config as one unit (`setCustomNetwork` replaces,
 * never merges — see `CustomNetworkConfig`'s own docstring), and only THEN
 * commits the network switch and kicks the sync service, resolving `true`.
 * Both orderings are load-bearing: clear-before-persist keeps an in-flight
 * chain-A query from re-inserting its rows after the sweep, and
 * persist-before-switch means the app never observes `custom` as the ACTIVE
 * network while it is unconfigured. The component uses the resolved boolean
 * to decide whether to `resolve()` the sheet closed — a failed validation
 * must leave the sheet open.
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

        // Clear BEFORE the store write, not after. setCustomNetwork fires the
        // custom-network store subscription synchronously, which repoints every
        // ky client at the new chain — so a chain-A query still in flight when
        // Save is pressed (the sync service is actively polling, since the
        // developer is already ON custom) could write its rows back after the
        // DELETE and survive under the single `custom` partition, which is the
        // precise outcome this sweep exists to prevent. removeQueries can evict
        // the cache entry but cannot undo the DB write. `shouldClear` is
        // computed from `previous`, so nothing here needs the store updated
        // first.
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
