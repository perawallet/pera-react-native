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

import { useSettings } from '@perawallet/wallet-core-settings'
// Subpath imports (not the @components/core barrel) so integration tests'
// PWSlideToConfirm subpath mock still intercepts the slide surface here.
import {
    PWSlideToConfirm,
    type PWSlideToConfirmProps,
} from '@components/core/PWSlideToConfirm'
import { PWTapToConfirm } from '@components/core/PWTapToConfirm'
import { useLanguage } from '@hooks/useLanguage'

export type ConfirmActionProps = PWSlideToConfirmProps

export const ConfirmAction = ({ title, ...rest }: ConfirmActionProps) => {
    const { confirmationMode } = useSettings()
    const { t } = useLanguage()

    if (confirmationMode === 'tap') {
        // Callsite titles say "Slide To Confirm", which is wrong for a button —
        // substitute the tap copy instead of passing `title` through.
        return (
            <PWTapToConfirm
                title={t('common.tap_to_confirm.label')}
                armedTitle={t('common.tap_to_confirm.tap_again_label')}
                {...rest}
            />
        )
    }

    return (
        <PWSlideToConfirm
            title={title}
            {...rest}
        />
    )
}
