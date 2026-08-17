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

export { PinEntry, type PinEntryProps } from './components/PinEntry'
export {
    PinEditView,
    type PinEditViewProps,
    type PinEntryMode,
} from './components/PinEditView'
export {
    PinEditContent,
    type PinEditContentProps,
} from './components/PinEditContent'
export {
    useRequirePinVerification,
    type UseRequirePinVerificationResult,
} from './hooks/useRequirePinVerification'
// Re-exported rather than re-homed: AutoLockGuard publishes it, so this stays
// the natural place to ask. The file itself lives under @hooks so
// @components/core can read it without pulling this module's persisted stores.
export { useIsLockOverlayVisible } from '@hooks/useIsLockOverlayVisible'
