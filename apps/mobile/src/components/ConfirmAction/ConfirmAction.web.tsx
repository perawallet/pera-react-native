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

import { PWTapToConfirm } from '@components/core/PWTapToConfirm'
import { useLanguage } from '@hooks/useLanguage'
import type { ConfirmActionProps } from './ConfirmAction'

// Web always confirms by tap: swipe is awkward with a mouse, so the stored
// slide/tap preference is ignored here and its Advanced Preferences entry is
// hidden (routeCapabilities.confirmationModeSetting, capabilities.web.ts).
// Callsite titles say "Slide To Confirm", which is wrong for a button —
// substitute the tap copy instead of passing `title` through.
export const ConfirmAction = ({ title: _, ...rest }: ConfirmActionProps) => {
    const { t } = useLanguage()

    return (
        <PWTapToConfirm
            title={t('common.tap_to_confirm.label')}
            armedTitle={t('common.tap_to_confirm.tap_again_label')}
            {...rest}
        />
    )
}
