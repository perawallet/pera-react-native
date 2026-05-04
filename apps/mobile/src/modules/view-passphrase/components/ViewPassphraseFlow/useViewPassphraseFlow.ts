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

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePinCode } from '@perawallet/wallet-core-security'

export type ViewPassphraseFlowStep = 'pin' | 'acknowledge' | 'display' | null

export type UseViewPassphraseFlowParams = {
    isVisible: boolean
    onClose: () => void
}

export type UseViewPassphraseFlowResult = {
    step: ViewPassphraseFlowStep
    handlePinSuccess: () => void
    handleAcknowledgeConfirm: () => void
    handleAcknowledgeClose: () => void
}

export const useViewPassphraseFlow = ({
    isVisible,
    onClose,
}: UseViewPassphraseFlowParams): UseViewPassphraseFlowResult => {
    const { checkPinEnabled } = usePinCode()
    const [step, setStep] = useState<ViewPassphraseFlowStep>(null)
    // Each PWBottomSheet fires its onBackdropPress handler whenever it
    // dismisses for any reason — including the programmatic dismiss that
    // happens when we hand off to the next step. Mark a transition before
    // changing the step so the outgoing sheet's dismiss callback knows to
    // ignore it.
    const skipNextAcknowledgeCloseRef = useRef(false)

    // When the parent opens the flow, decide the entry step based on whether a
    // PIN is set. When the parent closes it, drop back to null so the next
    // open re-runs the gate.
    useEffect(() => {
        if (!isVisible) {
            setStep(null)
            return
        }
        let cancelled = false
        ;(async () => {
            const pinEnabled = await checkPinEnabled()
            if (cancelled) return
            setStep(pinEnabled ? 'pin' : 'acknowledge')
        })()
        return () => {
            cancelled = true
        }
    }, [isVisible, checkPinEnabled])

    const handlePinSuccess = useCallback(() => {
        setStep('acknowledge')
    }, [])

    const handleAcknowledgeConfirm = useCallback(() => {
        skipNextAcknowledgeCloseRef.current = true
        setStep('display')
    }, [])

    const handleAcknowledgeClose = useCallback(() => {
        if (skipNextAcknowledgeCloseRef.current) {
            skipNextAcknowledgeCloseRef.current = false
            return
        }
        onClose()
    }, [onClose])

    return {
        step,
        handlePinSuccess,
        handleAcknowledgeConfirm,
        handleAcknowledgeClose,
    }
}
