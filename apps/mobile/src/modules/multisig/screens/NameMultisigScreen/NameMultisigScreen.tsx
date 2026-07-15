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

import { NameAccountForm } from '@components/NameAccountForm'
import { useLanguage } from '@hooks/useLanguage'
import { useNameMultisigScreen } from './useNameMultisigScreen'

export const NameMultisigScreen = () => {
    const { t } = useLanguage()
    const {
        accountName,
        isCreating,
        isFinishDisabled,
        handleNameChange,
        handleFinish,
    } = useNameMultisigScreen()

    return (
        <NameAccountForm
            title={t('multisig.name.title')}
            description={t('multisig.name.description')}
            finishButtonTitle={t('multisig.name.finish_button')}
            loadingTitle={t('multisig.name.creating')}
            value={accountName}
            onChangeText={handleNameChange}
            onFinish={() => void handleFinish()}
            isLoading={isCreating}
            isDisabled={isFinishDisabled}
        />
    )
}
