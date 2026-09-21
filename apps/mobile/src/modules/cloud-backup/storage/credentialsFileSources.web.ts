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

import { getSurface } from '@perawallet/wallet-extension-platform-chrome'

import type { CredentialsFileSource } from './types'

// No native SDK for either cloud in the extension, so only a local file.
const DEVICE_ONLY: CredentialsFileSource[] = ['device']
const NONE: CredentialsFileSource[] = []

// Saving hands the file to a download, which the popup survives.
export const getCredentialsFileSaveSources = (): CredentialsFileSource[] =>
    DEVICE_ONLY

// Reading opens an OS file dialog, and Chrome tears the toolbar popup down the
// instant that takes focus. The expanded tab has no such problem.
export const getCredentialsFileReadSources = (): CredentialsFileSource[] =>
    getSurface() === 'popup' ? NONE : DEVICE_ONLY
