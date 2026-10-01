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

import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'

export type LedgerReconnectingContentProps = {
    onCancel: () => void
}

/**
 * Shown while a user-requested retry reconnects to the device.
 *
 * The first connect attempt of a session is deliberately silent — no UI until
 * the device answers — but a retry the user asked for has to stay on screen and
 * stay cancellable, or a slow connect (up to the 20s ceiling) leaves them on the
 * calling screen with no way out.
 *
 * Style-less by design, like its sibling phase contents: `ConfirmActionContent`
 * owns the layout, and this only binds copy and the cancel action.
 */
export const LedgerReconnectingContent = ({
    onCancel,
}: LedgerReconnectingContentProps) => {
    const { t } = useLanguage()

    return (
        <ConfirmActionContent
            title={t('ledger.connecting.title')}
            message={t('ledger.connecting.subtitle')}
            confirmLabel={t('ledger.signing.cancel')}
            confirmVariant='secondary'
            onConfirm={onCancel}
            testID='ledger-reconnecting-content'
        />
    )
}
