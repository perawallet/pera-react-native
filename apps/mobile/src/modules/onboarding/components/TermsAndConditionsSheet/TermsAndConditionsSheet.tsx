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

import { useCallback } from 'react'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { TermsAcceptanceView } from './TermsAcceptanceView'

/**
 * Bottom-sheet presenter for the Terms & Conditions, used by the welcome-screen
 * gate. Resolves the sheet once the user agrees. The host opens it blocking
 * (no backdrop close) — see `useOnboardingScreen`.
 */
export const TermsAndConditionsSheet = () => {
    const { resolve } = useBottomSheetResult<boolean>()
    const onAccepted = useCallback(() => resolve(true), [resolve])

    return <TermsAcceptanceView onAccepted={onAccepted} />
}
