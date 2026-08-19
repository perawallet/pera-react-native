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

import { useSettingsStore } from '../store'

export const useSettings = () => {
    const theme = useSettingsStore(state => state.theme)
    const privacyMode = useSettingsStore(state => state.privacyMode)
    const language = useSettingsStore(state => state.language)
    const confirmationMode = useSettingsStore(state => state.confirmationMode)
    const setTheme = useSettingsStore(state => state.setTheme)
    const setPrivacyMode = useSettingsStore(state => state.setPrivacyMode)
    const setLanguage = useSettingsStore(state => state.setLanguage)
    const setConfirmationMode = useSettingsStore(
        state => state.setConfirmationMode,
    )

    return {
        theme,
        privacyMode,
        language,
        confirmationMode,
        setTheme,
        setPrivacyMode,
        setLanguage,
        setConfirmationMode,
    }
}
