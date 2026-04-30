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
import { PinEditView } from '@modules/security/components/PinEditView'
import { PassphraseAcknowledgeBottomSheet } from '../PassphraseAcknowledgeBottomSheet'
import { ViewPassphraseBottomSheet } from '../ViewPassphraseBottomSheet'

export type ViewPassphraseFlowProps = {
    isVisible: boolean
    address: string
    onClose: () => void
}

type Step = 'pin' | 'acknowledge' | 'display' | null

export const ViewPassphraseFlow = ({
    isVisible,
    address,
    onClose,
}: ViewPassphraseFlowProps) => {
    const { checkPinEnabled } = usePinCode()
    const [step, setStep] = useState<Step>(null)
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

    return (
        <>
            <PinEditView
                mode={step === 'pin' ? 'verify' : null}
                onSuccess={handlePinSuccess}
                onClose={onClose}
            />
            <PassphraseAcknowledgeBottomSheet
                isVisible={step === 'acknowledge'}
                onClose={handleAcknowledgeClose}
                onConfirm={handleAcknowledgeConfirm}
            />
            <ViewPassphraseBottomSheet
                isVisible={step === 'display'}
                address={address}
                onClose={onClose}
            />
        </>
    )
}
