/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo, useState } from 'react'
import {
    useHardwareSigning,
    useSigningRequest,
    type HardwareSigningStatus,
} from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import {
    getLedgerErrorPresetByKind,
    type LedgerErrorPreset,
} from '@modules/ledger/utils/ledgerErrorPresets'

export type UseLedgerSigningOverlayResult = {
    isVisible: boolean
    status: HardwareSigningStatus
    deviceName: string | null
    currentTx: number | null
    totalTxs: number | null
    error: LedgerErrorPreset | null
    onCancel: () => void
    onRetry: () => void
    isTroubleshootingVisible: boolean
    onOpenTroubleshooting: () => void
    onCloseTroubleshooting: () => void
}

/**
 * UI adapter combining the store-only `useHardwareSigning` hook with
 * `useSigningRequest` to wire cancel/retry through to the signing machine,
 * and managing the local visibility of the troubleshooting bottom sheet.
 *
 * `isVisible` is derived from status: the silent-scan phase ('searching')
 * keeps the overlay hidden so the user only sees UI once the device
 * responds, matching Android's native behavior.
 */
export const useLedgerSigningOverlay = (): UseLedgerSigningOverlayResult => {
    const {
        isActive,
        status,
        deviceName,
        currentTx,
        totalTxs,
        error: errorPayload,
        resolveActiveRequest,
        dismiss,
    } = useHardwareSigning()
    const { t } = useLanguage()
    const { pendingSignRequests, rejectRequest, retryRequest } =
        useSigningRequest()

    const [isTroubleshootingVisible, setTroubleshootingVisible] =
        useState(false)

    const error = useMemo<LedgerErrorPreset | null>(() => {
        if (!errorPayload) return null
        return getLedgerErrorPresetByKind(errorPayload.kind, t)
    }, [errorPayload, t])

    const onCloseTroubleshooting = useCallback(() => {
        setTroubleshootingVisible(false)
    }, [])

    const onOpenTroubleshooting = useCallback(() => {
        setTroubleshootingVisible(true)
    }, [])

    const onCancel = useCallback(() => {
        const activeRequest = resolveActiveRequest(pendingSignRequests)
        if (activeRequest) {
            rejectRequest(activeRequest)
        }
        setTroubleshootingVisible(false)
        dismiss()
    }, [resolveActiveRequest, pendingSignRequests, rejectRequest, dismiss])

    const onRetry = useCallback(() => {
        if (!error?.isRetryable) return
        const activeRequest = resolveActiveRequest(pendingSignRequests)
        if (activeRequest) {
            retryRequest(activeRequest)
        }
    }, [error, resolveActiveRequest, pendingSignRequests, retryRequest])

    return {
        isVisible: isActive && status !== 'searching',
        status,
        deviceName,
        currentTx,
        totalTxs,
        error,
        onCancel,
        onRetry,
        isTroubleshootingVisible,
        onOpenTroubleshooting,
        onCloseTroubleshooting,
    }
}
