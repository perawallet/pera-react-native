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

import { describe, expect, it } from 'vitest'
import {
    AppError,
    ErrorCategory,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import { OauthStateMismatchError } from '../auth/oauth-login'
import { CardOrderNotVerifiedError } from '../card/errors'
import {
    CardAccountLinkedElsewhereError,
    CardCreateInProgressError,
    CardCreateUnavailableError,
    CardIntegrityAttestationRequiredError,
    CardOwnershipProofRejectedError,
    CardSetupIncompleteError,
    CardUserUnavailableError,
} from '../card-creation/errors'
import { OnboardingNotVerifiedError } from '../errors'
import {
    AutoDrawProgramUnverifiedError,
    AutoDrawTealUnverifiedError,
    CardEscrowNotConfiguredError,
} from '../escrow/errors'

type Case = {
    error: AppError
    name: string
    message: string
    category: ErrorCategory
    isRetryable: boolean
}

const cases: Case[] = [
    {
        error: new CardIntegrityAttestationRequiredError(),
        name: 'CardIntegrityAttestationRequiredError',
        message: 'Device verification is required to create a Pera Card.',
        category: ErrorCategory.UNKNOWN,
        isRetryable: false,
    },
    {
        error: new CardAccountLinkedElsewhereError(),
        name: 'CardAccountLinkedElsewhereError',
        message: 'This account is already linked to another Pera Card user.',
        category: ErrorCategory.ACCOUNTS,
        isRetryable: false,
    },
    {
        error: new CardUserUnavailableError(),
        name: 'CardUserUnavailableError',
        message:
            'Your Pera Card account could not be loaded. Please sign in again.',
        category: ErrorCategory.ACCOUNTS,
        isRetryable: false,
    },
    {
        error: new CardCreateInProgressError(),
        name: 'CardCreateInProgressError',
        message: 'Card creation is already in progress for this account.',
        category: ErrorCategory.NETWORK,
        isRetryable: true,
    },
    {
        error: new CardSetupIncompleteError(),
        name: 'CardSetupIncompleteError',
        message: 'Your Pera Card account setup is not complete yet.',
        category: ErrorCategory.ACCOUNTS,
        isRetryable: false,
    },
    {
        error: new CardOwnershipProofRejectedError(),
        name: 'CardOwnershipProofRejectedError',
        message: 'This account could not prove ownership for card creation.',
        category: ErrorCategory.ACCOUNTS,
        isRetryable: false,
    },
    {
        error: new CardCreateUnavailableError(),
        name: 'CardCreateUnavailableError',
        message: 'Card creation is temporarily unavailable.',
        category: ErrorCategory.NETWORK,
        isRetryable: true,
    },
    {
        error: new OnboardingNotVerifiedError(),
        name: 'OnboardingNotVerifiedError',
        message:
            'Identity verification must be submitted before registration can continue.',
        category: ErrorCategory.ACCOUNTS,
        isRetryable: false,
    },
    {
        error: new CardOrderNotVerifiedError(),
        name: 'CardOrderNotVerifiedError',
        message:
            'Identity verification must be approved before a card can be issued.',
        category: ErrorCategory.ACCOUNTS,
        isRetryable: false,
    },
    {
        error: new OauthStateMismatchError(),
        name: 'OauthStateMismatchError',
        message: 'Baanx OAuth state mismatch',
        category: ErrorCategory.VALIDATION,
        isRetryable: false,
    },
    {
        error: new AutoDrawTealUnverifiedError(),
        name: 'AutoDrawTealUnverifiedError',
        message: 'AutoDraw TEAL template does not match the pinned hash',
        category: ErrorCategory.BLOCKCHAIN,
        isRetryable: false,
    },
    {
        error: new CardEscrowNotConfiguredError(),
        name: 'CardEscrowNotConfiguredError',
        message: 'Pera Card chain config is incomplete (app ids / asset id)',
        category: ErrorCategory.BLOCKCHAIN,
        isRetryable: false,
    },
    {
        error: new AutoDrawProgramUnverifiedError('mainnet'),
        name: 'AutoDrawProgramUnverifiedError',
        message: 'AutoDraw program for mainnet does not match the pinned hash',
        category: ErrorCategory.BLOCKCHAIN,
        isRetryable: false,
    },
]

describe('card error taxonomy', () => {
    it.each(cases)(
        '$name keeps its name and message as an AppError',
        ({ error, name, message, category, isRetryable }) => {
            expect(error).toBeInstanceOf(AppError)
            expect(error.name).toBe(name)
            expect(error.message).toBe(message)
            expect(error.metadata.category).toBe(category)
            expect(error.metadata.retryable).toBe(isRetryable)
        },
    )

    // The app maps these to copy by class (useCardErrorToast); a key here
    // would make the generic toast path diverge from that copy.
    it.each(cases)(
        '$name declares no user-facing key and stays reportable',
        ({ error }) => {
            expect(error.metadata.messageKey).toBeUndefined()
            expect(isExpectedError(error)).toBe(false)
        },
    )

    it('keeps the backend code on the proof and unavailable errors', () => {
        expect(new CardOwnershipProofRejectedError('SIG_BAD').code).toBe(
            'SIG_BAD',
        )
        expect(new CardCreateUnavailableError('NODE_DOWN').code).toBe(
            'NODE_DOWN',
        )
    })
})
