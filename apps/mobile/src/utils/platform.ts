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

import { Platform } from 'react-native'

// Functions, not constants: specs swap Platform.OS per test, and a value read
// at import time would pin whichever OS the first import saw.
export const isIOS = (): boolean => Platform.OS === 'ios'

export const isAndroid = (): boolean => Platform.OS === 'android'
