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

import { useCallback, useEffect, useState } from 'react'
import { BackHandler } from 'react-native'
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

const toDraft = (config: CustomNetworkConfig | undefined): CustomNetworkDraft =>
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
    isOpen: boolean
    draft: CustomNetworkDraft
    errors: CustomNetworkSheetErrors
    isFetching: boolean
    open: () => void
    close: () => void
    handleFieldChange: (field: keyof CustomNetworkDraft, value: string) => void
    handleFetchGenesis: () => Promise<void>
    handleSave: () => Promise<void>
    handleReset: () => void
}

/**
 * Owns the custom-network config sheet end to end, as a small draft/errors
 * state machine gating a single commit point.
 *
 * `open` seeds the draft from whatever is already persisted (or blanks it
 * out for a first-time setup). Every keystroke stays in local draft state —
 * nothing reaches the store until Save. `close` (wired to the Cancel button,
 * `onDismiss`, `onBackdropPress`, and Android hardware back — see the
 * BackHandler effect below) always just discards the draft: the store and
 * the active network are untouched either way, so there is no path from
 * "opened the sheet" to "active-but-unconfigured custom network" that
 * doesn't go through a validated Save.
 *
 * `handleSave` is the ONLY place that writes anything: it validates both
 * URLs (shared `isValidEndpoint`) and requires a non-empty genesis hash —
 * failing either sets the matching error flag and returns before touching
 * the store, the cache, or the active network. On success it persists the
 * whole config as one unit (`setCustomNetwork` replaces, never merges — see
 * `CustomNetworkConfig`'s own docstring), clears the custom-network cache
 * when {@link shouldClearCustomCache} says the chain identity actually
 * changed, and only THEN commits the network switch and kicks the sync
 * service. Persist-before-switch is the entire point of this sheet: the app
 * must never observe `custom` as the ACTIVE network while it is unconfigured.
 */
export const useCustomNetworkSheet = (): UseCustomNetworkSheetResult => {
    const [isOpen, setIsOpen] = useState(false)
    const [draft, setDraft] = useState<CustomNetworkDraft>({
        ...BLANK_DRAFT,
    })
    const [errors, setErrors] = useState<CustomNetworkSheetErrors>({})
    const [isFetching, setIsFetching] = useState(false)
    const { switchNetwork } = useSwitchNetwork()
    const queryClient = useQueryClient()

    const open = useCallback(() => {
        setDraft(toDraft(getCustomNetworkConfig()))
        setErrors({})
        setIsOpen(true)
    }, [])

    const close = useCallback(() => {
        setIsOpen(false)
        setDraft({ ...BLANK_DRAFT })
        setErrors({})
    }, [])

    // Android hardware back has no built-in route to `close` here. Neither
    // PWBottomSheet.tsx nor the @gorhom/bottom-sheet / @gorhom/portal
    // libraries it wraps touch BackHandler at all (confirmed empirically —
    // zero references in any of the three). The app-wide back-blocking in
    // useBlockHardwareBackWhileSheetOpen only covers sheets opened through
    // the imperative useBottomSheet() request store; this sheet is mounted
    // directly (`isVisible={sheet.isOpen}`), so it never joins that store.
    // Without this effect, back falls through to the navigator's default
    // handling, which (per useBlockHardwareBackWhileSheetOpen's own comment)
    // pops the screen this sheet lives on instead of just the sheet — a
    // jarring surprise, though not a state-safety issue by itself, since
    // nothing persists outside `handleSave` regardless of how the component
    // unmounts. Wiring back to `close` makes it behave exactly like Cancel:
    // predictable, and consistent with how every other sheet in this app
    // already treats hardware back.
    useEffect(() => {
        if (!isOpen) {
            return undefined
        }

        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                close()
                return true
            },
        )

        return () => subscription.remove()
    }, [isOpen, close])

    const handleFieldChange = useCallback(
        (field: keyof CustomNetworkDraft, value: string) => {
            setDraft(prev => ({ ...prev, [field]: value }))
            if (
                field === 'algodUrl' ||
                field === 'indexerUrl' ||
                field === 'genesisHash'
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
            setErrors(prev => ({ ...prev, fetch: false, genesisHash: false }))
        } catch {
            setErrors(prev => ({ ...prev, fetch: true }))
        } finally {
            setIsFetching(false)
        }
    }, [draft.algodUrl, draft.algodToken])

    const handleSave = useCallback(async () => {
        const validationErrors: CustomNetworkSheetErrors = {
            algodUrl: !isValidEndpoint(draft.algodUrl),
            indexerUrl: !isValidEndpoint(draft.indexerUrl),
            genesisHash: draft.genesisHash.length === 0,
        }

        if (
            validationErrors.algodUrl ||
            validationErrors.indexerUrl ||
            validationErrors.genesisHash
        ) {
            setErrors(prev => ({ ...prev, ...validationErrors }))
            return
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

        useCustomNetworkStore.getState().setCustomNetwork(next)

        if (shouldClear) {
            await clearCustomNetworkCache(queryClient)
        }

        await switchNetwork(Networks.custom)
        try {
            const syncService = getSyncService()
            syncService.invalidateQueries()
            syncService.restart()
        } catch {
            // SyncService not yet initialized
        }

        close()
    }, [draft, queryClient, switchNetwork, close])

    const handleReset = useCallback(() => {
        setDraft({ ...BLANK_DRAFT })
        setErrors({})
    }, [])

    return {
        isOpen,
        draft,
        errors,
        isFetching,
        open,
        close,
        handleFieldChange,
        handleFetchGenesis,
        handleSave,
        handleReset,
    }
}
