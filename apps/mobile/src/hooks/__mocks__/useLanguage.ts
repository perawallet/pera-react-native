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

// Picked up by a factory-less `vi.mock('@hooks/useLanguage')`. `t` echoes the
// key and ignores interpolation, so specs assert on i18n keys; a spec that
// needs the options in the output writes its own factory.
export const useLanguage = () => ({
    t: (key: string) => key,
    currentLanguage: 'en',
    changeLanguage: () => undefined,
})
