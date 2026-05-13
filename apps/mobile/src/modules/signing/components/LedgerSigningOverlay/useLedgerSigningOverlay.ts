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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useHardwareSigning,
    useSigningRequest,
    type HardwareSigningStatus,
} from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import {
    getLedgerErrorPresetByKind,
    type LedgerErrorPreset,
    type LedgerErrorPresetKind,
} from '@modules/ledger/utils/ledgerErrorPresets'

/**
 * Error kinds where the user-actionable recovery is "check the device /
 * bluetooth / nearby" — i.e. exactly what the troubleshooting sheet covers.
 * For these, we skip the intermediate `LedgerErrorContent` and surface the
 * troubleshooting sheet directly, matching Android (which navigates to
 * `LedgerConnectionIssueBottomSheet` on scan failure without showing the
 * generic loading dialog first).
 */
const BLE_CLASS_ERROR_KINDS: ReadonlySet<LedgerErrorPresetKind> = new Set([
    'connection_failed',
    'connection_lost',
    'scan_timeout',
    'bluetooth_disabled',
    'bluetooth_permission',
])

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
    // Tracks whether the troubleshooting sheet was auto-opened by a
    // BLE-class error vs. user-opened from the "Connection issues?" link.
    // Auto-opens treat the troubleshooting sheet as the primary surface
    // and reject the underlying request on dismiss; manual opens just
    // close the sheet and return to the error sheet below.
    const [autoOpenedForBleError, setAutoOpenedForBleError] = useState(false)

    const isBleClassError =
        errorPayload?.kind !== undefined &&
        BLE_CLASS_ERROR_KINDS.has(errorPayload.kind)

    // Auto-open the troubleshooting sheet on BLE-class errors. The effect
    // fires whenever the underlying error transitions into a BLE kind.
    useEffect(() => {
        if (isBleClassError) {
            setTroubleshootingVisible(true)
            setAutoOpenedForBleError(true)
        } else {
            setAutoOpenedForBleError(false)
        }
    }, [isBleClassError])

    const error = useMemo<LedgerErrorPreset | null>(() => {
        if (!errorPayload) return null
        return getLedgerErrorPresetByKind(errorPayload.kind, t)
    }, [errorPayload, t])

    const onCancel = useCallback(() => {
        const activeRequest = resolveActiveRequest(pendingSignRequests)
        if (activeRequest) {
            rejectRequest(activeRequest)
        }
        setTroubleshootingVisible(false)
        setAutoOpenedForBleError(false)
        dismiss()
    }, [resolveActiveRequest, pendingSignRequests, rejectRequest, dismiss])

    const onOpenTroubleshooting = useCallback(() => {
        setTroubleshootingVisible(true)
    }, [])

    const onCloseTroubleshooting = useCallback(() => {
        if (autoOpenedForBleError) {
            // Dismissing a BLE-class auto-opened troubleshooting sheet is
            // the user's cancel action — there's no underlying error sheet
            // to fall back to, so reject the request and dismiss the
            // overlay state in one motion.
            onCancel()
            return
        }
        setTroubleshootingVisible(false)
    }, [autoOpenedForBleError, onCancel])

    const onRetry = useCallback(() => {
        if (!error?.isRetryable) return
        const activeRequest = resolveActiveRequest(pendingSignRequests)
        if (activeRequest) {
            retryRequest(activeRequest)
        }
    }, [error, resolveActiveRequest, pendingSignRequests, retryRequest])

    return {
        // For BLE-class errors the troubleshooting sheet is the primary
        // surface, so the main overlay stays hidden underneath. The silent
        // BLE-scan phase ('searching') also keeps the main overlay hidden.
        isVisible: isActive && status !== 'searching' && !isBleClassError,
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
