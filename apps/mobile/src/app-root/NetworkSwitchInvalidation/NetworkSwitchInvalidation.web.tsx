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

import { useNetworkSwitchInvalidation } from '@hooks/useNetworkSwitchInvalidation'

// Mounts INSIDE QueryProvider (and outside VaultGate so the lock never unmounts
// it): useNetworkSwitchInvalidation reads the query client from context, and
// calling it from the shell body crashes at boot with "No QueryClient set".
export const NetworkSwitchInvalidation = (): null => {
    useNetworkSwitchInvalidation()
    return null
}
