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

import { Trans } from 'react-i18next'
import { PWText } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'

export type PreviousRekeyWarningSheetProps = {
    /**
     * i18n base key for the sheet copy. Expected children:
     * `{i18nPrefix}.title`, `.body`, `.confirm`, `.cancel`. The `body` Trans
     * interpolates `currentAuth` and `source`; component children at indexes 0
     * and 1 are bodySemibold spans for those names, and index 2 is the
     * `Learn more` link pressed via {@link onLearnMore}.
     */
    i18nPrefix: string
    testID: string
    currentAuthName: string
    sourceName: string
    onLearnMore: () => void
    /** Defaults to 'primary'. Use 'destructive' for irrecoverable actions. */
    confirmVariant?: 'primary' | 'destructive'
}

export const PreviousRekeyWarningSheet = ({
    i18nPrefix,
    testID,
    currentAuthName,
    sourceName,
    onLearnMore,
    confirmVariant = 'primary',
}: PreviousRekeyWarningSheetProps) => {
    const { t } = useLanguage()
    return (
        <ConfirmActionContent
            icon='warning'
            iconVariant='error'
            title={t(`${i18nPrefix}.title`)}
            message={
                <PWText variant='body'>
                    <Trans
                        i18nKey={`${i18nPrefix}.body`}
                        values={{
                            currentAuth: currentAuthName,
                            source: sourceName,
                        }}
                        components={[
                            <PWText
                                key='auth'
                                variant='bodySemibold'
                            />,
                            <PWText
                                key='source'
                                variant='bodySemibold'
                            />,
                            <PWText
                                key='learn-more'
                                variant='link'
                                onPress={onLearnMore}
                            />,
                        ]}
                    />
                </PWText>
            }
            confirmLabel={t(`${i18nPrefix}.confirm`)}
            cancelLabel={t(`${i18nPrefix}.cancel`)}
            confirmVariant={confirmVariant}
            testID={testID}
        />
    )
}
