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

import { Fragment, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { mockContacts } from '@perawallet/wallet-core-dev-fixtures'

import { PWButton, PWListItem, PWScreen, PWText } from '@components/core'
import { startGalleryTour } from '@routes/galleryTour'
import { startApiRecording, startApiReplay } from './devApiMock'
import { useStyles } from './styles'
import { useSettingsDeveloperGalleryScreen } from './useSettingsDeveloperGalleryScreen'

export const SettingsDeveloperGalleryScreen = () => {
    const styles = useStyles()
    const { sections } = useSettingsDeveloperGalleryScreen()
    const { addContact } = useContacts()
    const queryClient = useQueryClient()

    // Dev-only: seed contacts (store-backed, holds across reloads).
    const handleSeedContacts = useCallback(() => {
        mockContacts.forEach(contact => {
            try {
                addContact(contact)
            } catch {
                // already seeded — ignore duplicate-address errors
            }
        })
    }, [addContact])

    // Dev-only: capture real API responses (run on an ONLINE build), then
    // browse the app to fill the dump.
    const handleRecordApi = useCallback(() => {
        startApiRecording()
    }, [])

    // Dev-only: replay captured responses + authored overrides, and refetch
    // so the lists repopulate through the mock.
    const handleReplayApi = useCallback(() => {
        void startApiReplay().then(() => queryClient.invalidateQueries())
    }, [queryClient])

    return (
        <PWScreen
            horizontalPadding='lg'
            testID='developer_gallery_screen'
        >
            <PWButton
                title='Run screenshot tour'
                variant='primary'
                onPress={startGalleryTour}
                testID='gallery_run_tour'
            />
            <PWButton
                title='Seed mock data (contacts)'
                variant='secondary'
                onPress={handleSeedContacts}
                testID='gallery_seed_data'
            />
            <PWButton
                title='Record API (online)'
                variant='secondary'
                onPress={handleRecordApi}
                testID='gallery_record_api'
            />
            <PWButton
                title='Replay API (offline)'
                variant='secondary'
                onPress={handleReplayApi}
                testID='gallery_replay_api'
            />
            {sections.map(section => (
                <Fragment key={section.title}>
                    <PWText
                        variant='bodySemibold'
                        style={styles.sectionHeader}
                    >
                        {section.title}
                    </PWText>
                    {section.items.map(item => (
                        <PWListItem
                            key={item.id}
                            icon='globe'
                            title={item.label}
                            onPress={item.onPress}
                            testID={`gallery_item_${item.id}`}
                        />
                    ))}
                </Fragment>
            ))}
        </PWScreen>
    )
}
