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

/**
 * Number of digits in the Baanx email/SMS verification code. Baanx's real
 * length is still unconfirmed (sandbox down) — this single constant drives the
 * `PWCodeInput` cell count and the `isValid` length check on both verify
 * screens, so it's a one-line change once known.
 */
export const CARD_VERIFICATION_CODE_LENGTH = 6

/**
 * Dev-only stand-in for the real verification code while the mock transport is
 * active. A code matching this is accepted; anything else surfaces the "wrong
 * code" error. Must be `CARD_VERIFICATION_CODE_LENGTH` digits (numeric, to fit
 * the segmented digit boxes). Remove with the dev mock once the sandbox works.
 */
export const MOCK_VALID_VERIFICATION_CODE = '123456'
