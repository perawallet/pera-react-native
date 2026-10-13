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

// react-native accepts `style` as an array and flattens it natively; a DOM
// element does not. React DOM walks the prop with for..in, so an array arrives
// as style["0"], which jsdom >= 29 rejects with a strict-mode TypeError where
// jsdom 27 silently no-opped it.
//
// Patched here rather than at each mock because many of the component mocks in
// this folder spread `...props` straight into a DOM tag, so any of them can carry the
// array form and the next one added would reintroduce the break. Narrow on
// purpose: only a lowercase (DOM) tag with an actually-array style is rewritten
// — composite components still receive the array, which is what react-native
// contracts promise them. The mocks all `require('react')`, so they share the
// module object patched here; vitest.setup.ts imports this module first so it
// runs before any vi.mock factory does.
const flattenMockStyle = (style: any): any => {
    if (!style || !Array.isArray(style)) return style
    return style.reduce(
        (merged: any, entry: any) =>
            Object.assign(merged, flattenMockStyle(entry)),
        {},
    )
}

const reactModule = require('react')
const createElementWithFlatStyle = reactModule.createElement
reactModule.createElement = (type: any, props: any, ...children: any[]) =>
    typeof type === 'string' && props && Array.isArray(props.style)
        ? createElementWithFlatStyle(
              type,
              { ...props, style: flattenMockStyle(props.style) },
              ...children,
          )
        : createElementWithFlatStyle(type, props, ...children)

export {}
