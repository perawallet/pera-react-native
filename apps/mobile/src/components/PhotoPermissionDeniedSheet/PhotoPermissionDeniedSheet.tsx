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

import { ConfirmActionBottomSheet } from '@components/ConfirmActionBottomSheet'
import { useLanguage } from '@hooks/useLanguage'

export type PhotoPermissionDeniedSheetProps = {
    isVisible: boolean
    onClose: () => void
    onOpenSettings: () => void
}

/**
 * Bottom sheet shown when the photo-library permission has been denied
 * permanently (iOS / legacy Android). Guides the user to the system
 * Settings app to grant access. Owns its own i18n copy so callers only
 * have to wire visibility + handlers.
 */
export const PhotoPermissionDeniedSheet = ({
    isVisible,
    onClose,
    onOpenSettings,
}: PhotoPermissionDeniedSheetProps) => {
    const { t } = useLanguage()

    return (
        <ConfirmActionBottomSheet
            isVisible={isVisible}
            onClose={onClose}
            onConfirm={onOpenSettings}
            title={t('image_picker.permission_title')}
            message={t('image_picker.permission_body')}
            confirmLabel={t('image_picker.open_settings.label')}
            cancelLabel={t('common.cancel.label')}
        />
    )
}
