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

// EIP-6963 wallet identity. The rdns is Pera's own domain reversed, which is
// how dApps tell wallets apart across reloads.
export const PERA_EIP6963_NAME = 'Pera Wallet'
export const PERA_EIP6963_RDNS = 'app.perawallet'

// Inlined rather than fetched: EIP-6963 requires a data URI, and a page must
// never be handed a URL into the extension.
export const PERA_EIP6963_ICON =
    'data:image/svg+xml;base64,' +
    'PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNSAyNCIgZmlsbD' +
    '0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1w' +
    'YXRoPSJ1cmwoI2NsaXAwXzc1MjkxXzIxNzY5MykiPgo8ZWxsaXBzZSBjeD0iMTIuMjk5MS' +
    'IgY3k9IjEyIiByeD0iMTIuMjk5MSIgcnk9IjEyIiBmaWxsPSIjRkZFRTU1Ii8+CjxwYXRo' +
    'IGQ9Ik0xMy4yMDgxIDYuODIyNjRDMTMuNTMzMyA4LjEzNzExIDEzLjQyMzMgOS4yOTMzNi' +
    'AxMi45NjI2IDkuNDA1MkMxMi41MDE4IDkuNTE3MDQgMTEuODY0NyA4LjU0MjEyIDExLjUz' +
    'OTUgNy4yMjc2NUMxMS4yMTQ0IDUuOTEzMTggMTEuMzI0MyA0Ljc1NjkzIDExLjc4NSA0Lj' +
    'Y0NTA5QzEyLjI0NTggNC41MzMyNSAxMi44ODI5IDUuNTA4MTcgMTMuMjA4MSA2LjgyMjY0' +
    'WiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTE4LjU3NzQgNy45NTI3N0MxNy44NTczID' +
    'cuMjA4MSAxNi40MjQ2IDcuNDA5OTQgMTUuMzc3NCA4LjQwMzU4QzE0LjMzMDMgOS4zOTcy' +
    'MyAxNC4wNjUxIDEwLjgwNjQgMTQuNzg1MiAxMS41NTExQzE1LjUwNTQgMTIuMjk1NyAxNi' +
    '45MzgxIDEyLjA5MzkgMTcuOTg1MiAxMS4xMDAzQzE5LjAzMjQgMTAuMTA2NiAxOS4yOTc2' +
    'IDguNjk3NDMgMTguNTc3NCA3Ljk1Mjc3WiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTT' +
    'EyLjg1IDE5LjM1NTRDMTMuMzEwNyAxOS4yNDM2IDEzLjQwNDUgMTguMDIxOSAxMy4wNTk0' +
    'IDE2LjYyNjdDMTIuNzE0MiAxNS4yMzE2IDEyLjA2MDkgMTQuMTkxMiAxMS42MDAyIDE0Lj' +
    'MwMzFDMTEuMTM5NCAxNC40MTQ5IDExLjA0NTcgMTUuNjM2NiAxMS4zOTA4IDE3LjAzMTdD' +
    'MTEuNzM1OSAxOC40MjY5IDEyLjM4OTIgMTkuNDY3MiAxMi44NSAxOS4zNTU0WiIgZmlsbD' +
    '0iYmxhY2siLz4KPHBhdGggZD0iTTguMTUzMDIgOC42MzQ1MkM5LjQ4MjM0IDkuMDE3IDEw' +
    'LjQ1MzcgOS42ODggMTAuMzIyNiAxMC4xMzMyQzEwLjE5MTUgMTAuNTc4NSA5LjAwNzU0ID' +
    'EwLjYyOTQgNy42NzgyMyAxMC4yNDY5QzYuMzQ4OTEgOS44NjQ0MiA1LjM3NzU3IDkuMTkz' +
    'NDIgNS41MDg2OCA4Ljc0ODE3QzUuNjM5NzkgOC4zMDI5MyA2LjgyMzcgOC4yNTIwNCA4Lj' +
    'E1MzAyIDguNjM0NTJaIiBmaWxsPSJibGFjayIvPgo8cGF0aCBkPSJNMTYuNzgwOSAxMy42' +
    'NjIyQzE4LjE5MTggMTQuMDY4MiAxOS4yMjkzIDE0Ljc1ODIgMTkuMDk4MSAxNS4yMDM1Qz' +
    'E4Ljk2NyAxNS42NDg3IDE3LjcxNyAxNS42ODA2IDE2LjMwNjEgMTUuMjc0NkMxNC44OTUx' +
    'IDE0Ljg2ODcgMTMuODU3NyAxNC4xNzg2IDEzLjk4ODggMTMuNzMzNEMxNC4xMTk5IDEzLj' +
    'I4ODEgMTUuMzY5OSAxMy4yNTYzIDE2Ljc4MDkgMTMuNjYyMloiIGZpbGw9ImJsYWNrIi8+' +
    'CjxwYXRoIGQ9Ik05LjY0ODgxIDEyLjcyOEM5LjMxOTE2IDEyLjM5NDYgOC4yMzc5IDEyLj' +
    'g3OTkgNy4yMzM3NSAxMy44MTE5QzYuMjI5NiAxNC43NDM5IDUuNjgyODEgMTUuNzY5NyA2' +
    'LjAxMjQ2IDE2LjEwMzFDNi4zNDIxMSAxNi40MzY1IDcuNDIzMzcgMTUuOTUxMiA4LjQyNz' +
    'UyIDE1LjAxOTJDOS40MzE2NyAxNC4wODcyIDkuOTc4NDYgMTMuMDYxNCA5LjY0ODgxIDEy' +
    'LjcyOFoiIGZpbGw9ImJsYWNrIi8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcD' +
    'BfNzUyOTFfMjE3NjkzIj4KPHJlY3Qgd2lkdGg9IjI0LjU5ODEiIGhlaWdodD0iMjQiIGZp' +
    'bGw9IndoaXRlIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg=='
