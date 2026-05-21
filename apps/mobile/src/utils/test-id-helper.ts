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
 * Returns props for testing/automation.
 * On Android, we set both testID and accessibilityLabel for better Appium support.
 * On iOS, testID is usually sufficient as it maps to accessibilityIdentifier.
 *
 * @param {string} id - The unique ID for the element.
 * @param {string} [suffix] - Optional suffix for the ID.
 * @returns {object} - The test props.
 */
export function getTestProps(id?: string, suffix?: string) {
    if (!id) {
        return {}
    }

    const suffixedID = suffix ? `${id}_${suffix}` : id

    return {
        testID: suffixedID,
        accessibilityLabel: suffixedID, // Set on both platforms per Appium Pro recommendation
        accessibilityIdentifier: suffixedID,
        accessible: true,
    }
}

/**
 * Screen/list wrappers: keep testID for automation without grouping
 * child elements on iOS.
 */
export function getContainerTestProps(id?: string) {
    if (!id) {
        return {}
    }

    return {
        testID: id,
        accessibilityIdentifier: id,
        accessible: false,
    }
}

/**
 * Checkbox automation props for Appium on iOS and Android.
 */
export function getCheckboxTestProps(
    id: string,
    checked: boolean,
    disabled?: boolean,
) {
    return {
        ...getTestProps(id),
        accessibilityRole: 'checkbox' as const,
        accessibilityState: { checked, disabled: !!disabled },
    }
}
