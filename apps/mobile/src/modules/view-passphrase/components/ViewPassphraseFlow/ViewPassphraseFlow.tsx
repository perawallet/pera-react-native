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

import { PinEditView } from '@modules/security/components/PinEditView'
import { PassphraseAcknowledgeBottomSheet } from '../PassphraseAcknowledgeBottomSheet'
import { ViewPassphraseBottomSheet } from '../ViewPassphraseBottomSheet'
import { useViewPassphraseFlow } from './useViewPassphraseFlow'

export type ViewPassphraseFlowProps = {
    isVisible: boolean
    address: string
    onClose: () => void
}

export const ViewPassphraseFlow = ({
    isVisible,
    address,
    onClose,
}: ViewPassphraseFlowProps) => {
    const {
        step,
        handlePinSuccess,
        handleAcknowledgeConfirm,
        handleAcknowledgeClose,
    } = useViewPassphraseFlow({ isVisible, onClose })

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
