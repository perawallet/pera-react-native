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

import { useCallback } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import type { PromptViewProps } from '@modules/prompts/models'
import { TermsAcceptanceView } from './TermsAcceptanceView'

/** Prompt-queue id for the Terms & Conditions re-acceptance prompt. */
export const TERMS_ACCEPTANCE_PROMPT_ID = 'terms_acceptance_prompt'

/**
 * Prompt-container presenter for the Terms & Conditions, shown to already-
 * onboarded users when the required terms version no longer matches what they
 * last accepted. Agreeing records the new version (inside the view) and hides
 * the prompt; there is no skip — re-acceptance is required.
 */
export const TermsAcceptancePrompt = ({ onHide }: PromptViewProps) => {
    const { t } = useLanguage()
    const onAccepted = useCallback(
        () => onHide(TERMS_ACCEPTANCE_PROMPT_ID),
        [onHide],
    )

    return (
        <TermsAcceptanceView
            onAccepted={onAccepted}
            title={t('onboarding.terms_sheet.updated_title')}
        />
    )
}
