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

import { getProvider } from '@perawallet/wallet-extension-provider'
import type { LiquidAuthExtension } from '@perawallet/wallet-extension-liquid-auth'
import { LiquidAuthServiceUnavailableError } from '../errors'

/**
 * Returns the Liquid Auth service registered on the provider. Throws if
 * `WithLiquidAuth` has not been composed into the provider. Not a subscribing
 * hook — named for consistency with other provider-service accessors.
 */
export const useLiquidAuthService = (): LiquidAuthExtension['liquidAuth'] => {
    const provider = getProvider() as unknown as Partial<LiquidAuthExtension>
    if (!provider.liquidAuth) {
        throw new LiquidAuthServiceUnavailableError()
    }
    return provider.liquidAuth
}
