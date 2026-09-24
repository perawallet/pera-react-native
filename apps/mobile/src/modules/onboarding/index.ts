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

// The navigators live in `@modules/onboarding/routes`: they mount screens from
// ledger, cloud-backup and accounts, all of which import this file.
export { MnemonicSuggestionBar } from './components/MnemonicSuggestionBar'
export {
    TERMS_ACCEPTANCE_PROMPT_ID,
    TermsAcceptancePrompt,
} from './components/TermsAndConditionsSheet'
export {
    useExitAccountFlow,
    useIsOnboarding,
    useMnemonicWordEntry,
    usePeraWebImportFlowStore,
    useShouldPlayConfetti,
} from './hooks'
export { useTermsAcceptance } from './hooks/useTermsAcceptance'
export type {
    AddAccountStackParamList,
    OnboardingStackParamList,
    PostCreateReturnTarget,
} from './routes/types'
