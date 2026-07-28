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
import { type NodeEndpointOverride } from '@perawallet/wallet-core-blockchain'
import type { NetworkRow } from './useSettingsDeveloperNodeSettingsScreen'

// Duplicated from useSettingsDeveloperNodeSettingsScreen(.web) on purpose:
// this file is imported by the shared NodeSettingsRow, which is itself
// imported by both the native screen and `.web.tsx` screen. A bare import of
// `./useSettingsDeveloperNodeSettingsScreen` resolves to the `.web` sibling
// on web bundles regardless of which file does the importing, so pulling the
// validator in from there would silently break on one platform.
const isValidEndpoint = (value: string): boolean => {
    try {
        const { protocol } = new URL(value)
        return protocol === 'http:' || protocol === 'https:'
    } catch {
        return false
    }
}

type UseNodeSettingsRowParams = {
    row: NetworkRow
    onSave: (endpoints: NodeEndpointOverride) => void
    onReset: () => void
}

type UseNodeSettingsRowResult = {
    algodUrlInput: string
    indexerUrlInput: string
    algodUrlError: boolean
    indexerUrlError: boolean
    handleAlgodUrlChange: (text: string) => void
    handleIndexerUrlChange: (text: string) => void
    handleSave: () => void
    handleReset: () => void
}

/**
 * Local editable-draft state for one network's endpoint row. Keeps the two
 * fields uncontrolled-by-the-store until Save so typing a URL character by
 * character doesn't flash a validation error on every keystroke, then shows
 * an inline error for whichever field the parent's `saveEndpoints` silently
 * dropped (it never persists a malformed URL — see `isValidEndpoint` there).
 */
export const useNodeSettingsRow = ({
    row,
    onSave,
    onReset,
}: UseNodeSettingsRowParams): UseNodeSettingsRowResult => {
    const [algodUrlInput, setAlgodUrlInput] = useState(row.algodUrl)
    const [indexerUrlInput, setIndexerUrlInput] = useState(row.indexerUrl)
    const [algodUrlError, setAlgodUrlError] = useState(false)
    const [indexerUrlError, setIndexerUrlError] = useState(false)

    // Re-sync the drafts whenever the committed values change underneath —
    // after a successful save, or after `resetEndpoints` restores the baked
    // default. A rejected save never changes `row.algodUrl`/`indexerUrl`, so
    // this deliberately does NOT fire then: the user's bad input and its
    // error stay on screen for them to fix.
    useEffect(() => {
        setAlgodUrlInput(row.algodUrl)
        setIndexerUrlInput(row.indexerUrl)
        setAlgodUrlError(false)
        setIndexerUrlError(false)
    }, [row.algodUrl, row.indexerUrl])

    const handleAlgodUrlChange = useCallback((text: string) => {
        setAlgodUrlInput(text)
        setAlgodUrlError(false)
    }, [])

    const handleIndexerUrlChange = useCallback((text: string) => {
        setIndexerUrlInput(text)
        setIndexerUrlError(false)
    }, [])

    const handleSave = useCallback(() => {
        setAlgodUrlError(!isValidEndpoint(algodUrlInput))
        setIndexerUrlError(!isValidEndpoint(indexerUrlInput))
        // Safe either way: the screen-level hook re-validates independently
        // and drops whichever field is malformed before it ever reaches the
        // store. This local check only decides what to show inline.
        onSave({ algodUrl: algodUrlInput, indexerUrl: indexerUrlInput })
    }, [algodUrlInput, indexerUrlInput, onSave])

    const handleReset = useCallback(() => {
        onReset()
    }, [onReset])

    return {
        algodUrlInput,
        indexerUrlInput,
        algodUrlError,
        indexerUrlError,
        handleAlgodUrlChange,
        handleIndexerUrlChange,
        handleSave,
        handleReset,
    }
}
