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

import { logger } from '@perawallet/wallet-core-shared'
import type {
    PasskeyAutofillService,
    PasswordCredentialIdentity,
} from '@perawallet/wallet-extension-passkey-autofill'
import type { Login } from '../models/login'
import { listLogins } from '../storage/loginStore'

type IdentityPublisher = Pick<
    PasskeyAutofillService,
    'replacePasswordCredentialIdentities'
>

export const toPasswordIdentities = (
    logins: Login[],
): PasswordCredentialIdentity[] =>
    logins
        .filter(login => login.domain !== '')
        .map(login => ({
            recordIdentifier: login.id,
            serviceIdentifier: login.domain,
            user: login.username,
        }))

/**
 * Replaces the OS index wholesale rather than diffing it. The index is a cache
 * of the keystore, so a full replace is self-healing — a missed delta would
 * leave a stale row the system offers and the provider then cannot resolve.
 */
export const publishLoginIdentities = async (
    service: IdentityPublisher,
): Promise<void> => {
    try {
        const logins = await listLogins()
        await service.replacePasswordCredentialIdentities(
            toPasswordIdentities(logins),
        )
    } catch (err) {
        // A failed publish costs autofill availability, never data. Surfacing it
        // as a mutation failure would make a saved login look unsaved.
        logger.error(err as Error, { step: 'publishLoginIdentities' })
    }
}
