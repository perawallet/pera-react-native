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

import { Platform } from 'react-native';

/**
 * Returns props for testing/automation.
 * On Android, we set both testID and accessibilityLabel for better Appium support.
 * On iOS, testID is usually sufficient as it maps to accessibilityIdentifier.
 *
 * @param {string} id - The unique ID for the element.
 * @returns {object} - The test props.
 */
export function getTestProps(id?: string) {
    if (!id) {
        return {};
    }

    return {
        testID: id,
        accessibilityLabel: Platform.OS === 'android' ? id : undefined,
    };
}
