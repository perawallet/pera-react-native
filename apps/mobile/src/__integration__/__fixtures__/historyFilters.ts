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

import { expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

/**
 * History leaves suspicious rows out by default; a spec about how they look
 * turns them on the way the user does, through the filter sheet.
 */
export const showSuspiciousTransactions = async (): Promise<void> => {
    fireEvent.click(
        await screen.findByText('asset_details.transaction_list.filter'),
    )
    fireEvent.click(await screen.findByTestId('history_filter_show_suspicious'))
    await waitFor(() =>
        expect(
            screen.queryByTestId('history_filter_show_suspicious'),
        ).toBeNull(),
    )
}
