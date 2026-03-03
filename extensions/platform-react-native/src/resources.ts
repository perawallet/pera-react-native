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

import type { KeyValueStorageService } from '@perawallet/wallet-extension-platform'
import { RNKeyValueStorageService } from './services'

/**
 * Module-level singleton for the React Native KeyValueStorageService.
 *
 * MMKV construction is synchronous via JSI, so this is safe to create at
 * module scope. Metro aliases `@perawallet/wallet-extension-platform-resources`
 * to this file at build time, allowing stores to import the real MMKV-backed
 * storage without lazy initialization.
 */
export const keyValueStorage: KeyValueStorageService =
    new RNKeyValueStorageService()
