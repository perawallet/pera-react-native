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

// A cast can bury a branded type in a union, a generic argument or a record, so
// the whole target type is walked, not just its outermost reference.
export const mentionsTypeReference = (value, typeName) => {
    if (Array.isArray(value)) {
        return value.some(item => mentionsTypeReference(item, typeName))
    }
    if (value === null || typeof value !== 'object') return false
    if (value.type === 'TSTypeReference') {
        const { typeName: reference } = value
        const name =
            reference.type === 'Identifier'
                ? reference.name
                : reference.right?.name
        if (name === typeName) return true
    }
    return Object.keys(value).some(
        key =>
            key !== 'parent' &&
            key !== 'loc' &&
            key !== 'range' &&
            mentionsTypeReference(value[key], typeName),
    )
}
