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

import { NameAccountForm } from '@components/NameAccountForm'
import { useLanguage } from '@hooks/useLanguage'
import { useMultisigInvitationNameScreen } from './useMultisigInvitationNameScreen'

export const MultisigInvitationNameScreen = () => {
    const { t } = useLanguage()
    const {
        accountName,
        isSaving,
        nameError,
        isFinishDisabled,
        handleNameChange,
        handleFinish,
    } = useMultisigInvitationNameScreen()

    return (
        <NameAccountForm
            title={t('multisig.invitation.name.title')}
            description={t('multisig.invitation.name.description')}
            finishButtonTitle={t('multisig.invitation.name.finish_button')}
            loadingTitle={t('multisig.invitation.name.saving')}
            value={accountName}
            onChangeText={handleNameChange}
            onFinish={handleFinish}
            isLoading={isSaving}
            isDisabled={isFinishDisabled}
            errorMessage={nameError}
        />
    )
}
