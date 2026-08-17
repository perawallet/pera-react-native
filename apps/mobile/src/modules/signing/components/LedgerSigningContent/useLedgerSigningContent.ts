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

import { useCallback, useMemo } from 'react'
import {
    useHardwareSigningStore,
    useSigningPipeline,
    useSigningRequest,
    type HardwareChildSnapshot,
    type HardwareSigningOperation,
} from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import {
    getLedgerErrorPresetByKind,
    type LedgerErrorPreset,
} from '@modules/ledger/utils/ledgerErrorPresets'

type HardwareSigningStatus =
    | 'idle'
    | 'searching'
    | 'awaitingApproval'
    | 'signing'
    | 'error'

/**
 * Map the hardware child machine's snapshot to the legacy
 * HardwareSigningStatus enum the UI router still uses. The child machine's
 * state value carries the same information as the old store flag, so this
 * is a straight projection — no extra timing logic.
 */
const deriveStatus = (
    snapshot: HardwareChildSnapshot | null,
): HardwareSigningStatus => {
    if (!snapshot) return 'idle'
    if (snapshot.matches('error')) return 'error'
    if (snapshot.matches({ active: 'searching' })) return 'searching'
    if (snapshot.matches({ active: 'awaiting_approval' }))
        return 'awaitingApproval'
    if (snapshot.matches({ active: 'signing' })) return 'signing'
    return 'idle'
}

export type UseLedgerSigningContentResult = {
    isVisible: boolean
    status: HardwareSigningStatus
    deviceName: string | null
    currentTx: number | null
    totalTxs: number | null
    operation: HardwareSigningOperation
    error: LedgerErrorPreset | null
    onCancel: () => void
    onRetry: () => void
    isTroubleshootingVisible: boolean
    onOpenTroubleshooting: () => void
    onCloseTroubleshooting: () => void
}

/**
 * UI adapter for the Ledger signing sheet. Reads the hardware child
 * machine's live snapshot from `useSigningPipeline().resolved.activeChild`,
 * derives the display status, and wires cancel/retry through the parent
 * machine via the pipeline's hardware control methods.
 *
 * `isVisible` is derived from status: the silent-scan phase ('searching')
 * keeps the sheet closed so the user only sees UI once the device responds,
 * matching Android's native behavior.
 *
 * Every terminal error renders in this sheet, including connection-class
 * ones. Auto-opening the troubleshooting sheet instead (the previous
 * behavior) replaced the specific reason — Bluetooth off, device not found,
 * link lost — with a generic checklist, which is the exact complaint the
 * error taxonomy exists to answer. Troubleshooting is now reachable from the
 * link inside the error sheet, so the user gets the reason first and the
 * checklist on demand.
 *
 * Troubleshooting-sheet visibility lives in `useHardwareSigningStore` — the
 * slim store only owns the `isTroubleshootingVisible` flag plus its
 * open/close actions; phase, progress, error, and operation are all read
 * from the child machine snapshot.
 */
export const useLedgerSigningContent = (): UseLedgerSigningContentResult => {
    const { t } = useLanguage()
    const { resolved, retryHardware, acknowledgeHardwareError } =
        useSigningPipeline()
    const { currentRequest, rejectRequest } = useSigningRequest()

    const hardware =
        resolved?.activeChild?.kind === 'hardware'
            ? resolved.activeChild.snapshot
            : null
    const status = deriveStatus(hardware)
    const deviceName = hardware?.context.deviceName ?? null
    const currentTx = hardware?.context.currentTx ?? null
    const totalTxs = hardware?.context.totalTxs ?? null
    const errorPayload = hardware?.context.error ?? null
    const operation: HardwareSigningOperation =
        hardware?.context.operation ?? 'transaction'

    const manualTroubleshootingOpen = useHardwareSigningStore(
        s => s.isTroubleshootingVisible,
    )
    const openTroubleshooting = useHardwareSigningStore(
        s => s.openTroubleshooting,
    )
    const closeTroubleshooting = useHardwareSigningStore(
        s => s.closeTroubleshooting,
    )

    const error = useMemo<LedgerErrorPreset | null>(() => {
        if (!errorPayload) return null
        return getLedgerErrorPresetByKind(errorPayload.kind, t)
    }, [errorPayload, t])

    const onCancel = useCallback(() => {
        // Two distinct paths depending on where the child machine is:
        //   - in `error`: send ACKNOWLEDGE_HARDWARE_ERROR so the child can
        //     transition to its `done` final state with output kind:'error'.
        //     The parent then marks the request failed via the standard
        //     onDone handler.
        //   - mid-flow (searching/awaiting/signing): reject the request so
        //     the parent forwards USER_REJECTED → child as
        //     USER_REJECTED_ON_DEVICE.
        if (status === 'error') {
            acknowledgeHardwareError()
            return
        }
        if (currentRequest) {
            rejectRequest(currentRequest)
        }
    }, [status, acknowledgeHardwareError, currentRequest, rejectRequest])

    const onRetry = useCallback(() => {
        if (!error?.isRetryable) return
        retryHardware()
    }, [error, retryHardware])

    const onOpenTroubleshooting = useCallback(() => {
        openTroubleshooting()
    }, [openTroubleshooting])

    // Closing troubleshooting returns to the error sheet rather than
    // cancelling: the error sheet owns Retry/Cancel now.
    const onCloseTroubleshooting = useCallback(() => {
        closeTroubleshooting()
    }, [closeTroubleshooting])

    const isActive = status !== 'idle'

    return {
        isVisible: isActive && status !== 'searching',
        status,
        deviceName,
        currentTx,
        totalTxs,
        operation,
        error,
        onCancel,
        onRetry,
        isTroubleshootingVisible: manualTroubleshootingOpen,
        onOpenTroubleshooting,
        onCloseTroubleshooting,
    }
}
