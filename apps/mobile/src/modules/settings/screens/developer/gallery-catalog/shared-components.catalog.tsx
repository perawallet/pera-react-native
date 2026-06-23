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

import React from 'react'
import { Decimal } from 'decimal.js'

import { PWButton, PWText } from '@components/core'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { ContactAvatar } from '@components/ContactAvatar'
import { CopyableText } from '@components/CopyableText'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { CurrencyInput } from '@components/CurrencyInput'
import { EmptyView } from '@components/EmptyView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { ExpandableText } from '@components/ExpandableText'
import { InfoButton } from '@components/InfoButton'
import { KeyValueRow } from '@components/KeyValueRow'
import { LoadingView } from '@components/LoadingView'
import { MultisigInfoCard } from '@components/MultisigInfoCard'
import { NameAccountForm } from '@components/NameAccountForm'
import { NumberPad } from '@components/NumberPad'
import { PanelButton } from '@components/PanelButton'
import { ParticipantCount } from '@components/ParticipantCount'
import { RoundButton } from '@components/RoundButton'
import { ScreenHeader } from '@components/ScreenHeader'
import { SearchInput } from '@components/SearchInput'
import { TabLabel } from '@components/TabLabel'
import { TrendIndicator } from '@components/TrendIndicator'
import { ZoomableImage } from '@components/ZoomableImage'

import { registerPreview } from './registry'
import { VariantPreview } from './VariantPreview'

import type { GallerySection } from './types'

registerPreview({
    id: 'comp-contact-avatar',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'xs / no image',
                    node: (
                        <ContactAvatar
                            size='xs'
                            contact={{
                                name: 'Alice',
                                address: 'AAAA',
                                image: undefined,
                            }}
                        />
                    ),
                },
                {
                    label: 'md / no image / default',
                    node: (
                        <ContactAvatar
                            size='md'
                            contact={{
                                name: 'Alice',
                                address: 'AAAA',
                                image: undefined,
                            }}
                        />
                    ),
                },
                {
                    label: 'lg / no image / highlighted',
                    node: (
                        <ContactAvatar
                            size='lg'
                            variant='highlighted'
                            contact={{
                                name: 'Bob',
                                address: 'BBBB',
                                image: undefined,
                            }}
                        />
                    ),
                },
                {
                    label: 'xl / no contact',
                    node: <ContactAvatar size='xl' />,
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-copyable-text',
    render: () => (
        <CopyableText copyValue='AAABBBCCC111222333'>
            <PWText variant='body'>Long press to copy this text</PWText>
        </CopyableText>
    ),
})

registerPreview({
    id: 'comp-currency-display',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'USD / large / h2',
                    node: (
                        <CurrencyAmount
                            currency='USD'
                            value={new Decimal('1234567.89')}
                            precision='compact'
                            variant='h2'
                        />
                    ),
                },
                {
                    label: 'ALGO / medium / h3',
                    node: (
                        <CurrencyAmount
                            currency='ALGO'
                            value={new Decimal('42.500000')}
                            precision='assetFull'
                            assetDecimals={6}
                            variant='h3'
                        />
                    ),
                },
                {
                    label: 'USD / small / body',
                    node: (
                        <CurrencyAmount
                            currency='USD'
                            value={new Decimal('0.01')}
                            precision='compact'
                            variant='body'
                        />
                    ),
                },
                {
                    label: 'USD / zero / body',
                    node: (
                        <CurrencyAmount
                            currency='USD'
                            value={new Decimal('0')}
                            precision='compact'
                            variant='body'
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-trend-indicator',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'positive percentage',
                    node: <TrendIndicator percentage={new Decimal('3.47')} />,
                },
                {
                    label: 'negative percentage',
                    node: <TrendIndicator percentage={new Decimal('-1.23')} />,
                },
                {
                    label: 'zero (flat)',
                    node: <TrendIndicator percentage={new Decimal('0')} />,
                },
                {
                    label: 'positive + absolute amount',
                    node: (
                        <TrendIndicator
                            percentage={new Decimal('5.0')}
                            absolute={{
                                amount: new Decimal('12.34'),
                                currency: 'USD',
                                precision: 2,
                            }}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-participant-count',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'count 3 / default size',
                    node: <ParticipantCount count={3} />,
                },
                {
                    label: 'count 5 / h1',
                    node: (
                        <ParticipantCount
                            count={5}
                            size='h1'
                        />
                    ),
                },
                {
                    label: 'count 10 / h2 (default)',
                    node: <ParticipantCount count={10} />,
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-tab-label',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'active',
                    node: (
                        <TabLabel
                            i18nKey='common.assets'
                            active={true}
                        />
                    ),
                },
                {
                    label: 'inactive',
                    node: (
                        <TabLabel
                            i18nKey='common.activity'
                            active={false}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-expandable-panel',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'expanded',
                    node: (
                        <ExpandablePanel isExpanded={true}>
                            <PWText variant='body'>
                                This content is revealed when the panel is
                                expanded. It can contain any child nodes.
                            </PWText>
                        </ExpandablePanel>
                    ),
                },
                {
                    label: 'collapsed',
                    node: (
                        <ExpandablePanel isExpanded={false}>
                            <PWText variant='body'>
                                This content is hidden when the panel is
                                collapsed — you should not see this.
                            </PWText>
                        </ExpandablePanel>
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-expandable-text',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'long text (triggers Show more)',
                    node: (
                        <ExpandableText
                            text='Pera Wallet is a non-custodial Algorand wallet that gives you full control of your assets. It supports standard accounts, hardware wallets, multi-signature accounts, and rich NFT/collectible browsing. This is a longer description to trigger the "Show more" truncation behaviour.'
                            limit={100}
                        />
                    ),
                },
                {
                    label: 'short text (no Show more)',
                    node: (
                        <ExpandableText
                            text='Short description.'
                            limit={100}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-key-value-row',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'short value',
                    node: (
                        <KeyValueRow title='Account type'>
                            <PWText variant='bodyCompact'>Standard</PWText>
                        </KeyValueRow>
                    ),
                },
                {
                    label: 'long value',
                    node: (
                        <KeyValueRow title='Address'>
                            <PWText variant='bodyCompact'>
                                AAABBBCCC111222333444555666777888999000111222333444555666777888999
                            </PWText>
                        </KeyValueRow>
                    ),
                },
                {
                    label: 'network row',
                    node: (
                        <KeyValueRow title='Network'>
                            <PWText variant='bodyCompact'>
                                Algorand MainNet
                            </PWText>
                        </KeyValueRow>
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-empty-view',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'without action button',
                    node: (
                        <EmptyView
                            icon='magnifying-glass'
                            title='No results found'
                            body='Try adjusting your search or filters to find what you are looking for.'
                        />
                    ),
                },
                {
                    label: 'with action button',
                    node: (
                        <EmptyView
                            icon='magnifying-glass'
                            title='No assets yet'
                            body='Add your first asset to get started.'
                            button={
                                <PWButton
                                    variant='primary'
                                    title='Add asset'
                                    onPress={() => undefined}
                                />
                            }
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-loading-view',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'circle / sm',
                    node: (
                        <LoadingView
                            variant='circle'
                            size='sm'
                        />
                    ),
                },
                {
                    label: 'circle / lg',
                    node: (
                        <LoadingView
                            variant='circle'
                            size='lg'
                        />
                    ),
                },
                {
                    label: 'skeleton / 3 rows',
                    node: (
                        <LoadingView
                            variant='skeleton'
                            count={3}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-search-input',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'empty',
                    node: (
                        <SearchInput
                            placeholder='Search accounts, assets…'
                            value=''
                            onChangeText={() => undefined}
                        />
                    ),
                },
                {
                    label: 'with typed value',
                    node: (
                        <SearchInput
                            placeholder='Search accounts, assets…'
                            value='ALGO'
                            onChangeText={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-number-pad',
    render: () => (
        <NumberPad
            onPress={() => undefined}
            allowDecimal={true}
        />
    ),
})

registerPreview({
    id: 'comp-currency-input',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'empty',
                    node: (
                        <CurrencyInput
                            minPrecision={2}
                            maxPrecision={6}
                            value=''
                            onChangeText={() => undefined}
                        />
                    ),
                },
                {
                    label: 'with value',
                    node: (
                        <CurrencyInput
                            minPrecision={2}
                            maxPrecision={6}
                            value='42.5'
                            onChangeText={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-chart-period-selection',
    render: () => (
        <ChartPeriodSelection
            value='one-week'
            onChange={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-round-button',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'send / secondary / lg',
                    node: (
                        <RoundButton
                            icon='transactions/send'
                            title='Send'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'receive / primary / lg',
                    node: (
                        <RoundButton
                            icon='transactions/receive'
                            title='Receive'
                            variant='primary'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'send / secondary / sm',
                    node: (
                        <RoundButton
                            icon='transactions/send'
                            title='Send'
                            size='sm'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'no title',
                    node: (
                        <RoundButton
                            icon='transactions/send'
                            onPress={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-panel-button',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'default variant with description',
                    node: (
                        <PanelButton
                            leftIcon='wallet'
                            rightIcon='chevron-right'
                            title='Connect Hardware Wallet'
                            description='Use a Ledger device to keep your keys offline'
                            titleWeight='h3'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'error variant (destructive)',
                    node: (
                        <PanelButton
                            leftIcon='trash'
                            title='Remove account'
                            titleWeight='h4'
                            variant='error'
                            onPress={() => undefined}
                        />
                    ),
                },
                {
                    label: 'no description, no right icon',
                    node: (
                        <PanelButton
                            leftIcon='bell'
                            title='Notifications'
                            titleWeight='h4'
                            onPress={() => undefined}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-info-button',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'secondary / sm',
                    node: (
                        <InfoButton
                            variant='secondary'
                            size='sm'
                            title='Account type'
                        >
                            <PWText variant='body'>
                                A standard account is controlled by a single
                                private key stored on this device.
                            </PWText>
                        </InfoButton>
                    ),
                },
                {
                    label: 'primary / md',
                    node: (
                        <InfoButton
                            variant='primary'
                            size='md'
                            title='Multisig threshold'
                        >
                            <PWText variant='body'>
                                The threshold is the minimum number of signers
                                required to approve a transaction.
                            </PWText>
                        </InfoButton>
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-screen-header',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'with icon + description',
                    node: (
                        <ScreenHeader
                            icon='ledger'
                            title='Select Ledger account'
                            description='Choose which account you want to import from your Ledger device.'
                        />
                    ),
                },
                {
                    label: 'title only',
                    node: <ScreenHeader title='Simple header' />,
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-multisig-info-card',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: '2-of-3 / user included',
                    node: (
                        <MultisigInfoCard
                            totalParticipants={3}
                            threshold={2}
                            isUserIncluded={true}
                        />
                    ),
                },
                {
                    label: '3-of-5 / user not included',
                    node: (
                        <MultisigInfoCard
                            totalParticipants={5}
                            threshold={3}
                            isUserIncluded={false}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-name-account-form',
    render: () => (
        <VariantPreview
            items={[
                {
                    label: 'not loading',
                    node: (
                        <NameAccountForm
                            title='Name your account'
                            description='Give this account a nickname so you can easily find it later.'
                            finishButtonTitle='Save'
                            loadingTitle='Saving…'
                            value='My Main Wallet'
                            onChangeText={() => undefined}
                            onFinish={() => undefined}
                            isLoading={false}
                        />
                    ),
                },
                {
                    label: 'loading',
                    node: (
                        <NameAccountForm
                            title='Name your account'
                            description='Give this account a nickname so you can easily find it later.'
                            finishButtonTitle='Save'
                            loadingTitle='Saving…'
                            value='My Main Wallet'
                            onChangeText={() => undefined}
                            onFinish={() => undefined}
                            isLoading={true}
                        />
                    ),
                },
            ]}
        />
    ),
})

registerPreview({
    id: 'comp-zoomable-image',
    render: () => <ZoomableImage uri='https://via.placeholder.com/300' />,
})

export const getSharedComponentSections = (): GallerySection[] => [
    {
        title: 'Shared — display',
        items: [
            {
                id: 'comp-contact-avatar',
                label: 'ContactAvatar',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-copyable-text',
                label: 'CopyableText',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-currency-display',
                label: 'CurrencyAmount',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-trend-indicator',
                label: 'TrendIndicator',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-participant-count',
                label: 'ParticipantCount',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-tab-label',
                label: 'TabLabel',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — layout & panels',
        items: [
            {
                id: 'comp-expandable-panel',
                label: 'ExpandablePanel',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-expandable-text',
                label: 'ExpandableText',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-key-value-row',
                label: 'KeyValueRow',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — empty & loading states',
        items: [
            {
                id: 'comp-empty-view',
                label: 'EmptyView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-loading-view',
                label: 'LoadingView',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — inputs & number entry',
        items: [
            {
                id: 'comp-search-input',
                label: 'SearchInput',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-number-pad',
                label: 'NumberPad',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-currency-input',
                label: 'CurrencyInput',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-chart-period-selection',
                label: 'ChartPeriodSelection',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — buttons',
        items: [
            {
                id: 'comp-round-button',
                label: 'RoundButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-panel-button',
                label: 'PanelButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-info-button',
                label: 'InfoButton',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — screen chrome',
        items: [
            {
                id: 'comp-screen-header',
                label: 'ScreenHeader',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — multisig',
        items: [
            {
                id: 'comp-multisig-info-card',
                label: 'MultisigInfoCard',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Shared — forms',
        items: [
            {
                id: 'comp-name-account-form',
                label: 'NameAccountForm',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-contact-form',
                label: 'ContactForm (needs RHF control + QR)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Shared — media',
        items: [
            {
                id: 'comp-zoomable-image',
                label: 'ZoomableImage',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-audio-player',
                label: 'AudioPlayer (needs expo-audio)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-video-player',
                label: 'VideoPlayer (needs expo-video)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-media-carousel',
                label: 'MediaCarousel (needs expo-audio/video)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Shared — address & search',
        items: [
            {
                id: 'comp-address-display',
                label: 'AddressDisplay (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-address-entry-field',
                label: 'AddressEntryField (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-address-search-view',
                label: 'AddressSearchView (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-searchable-list',
                label: 'SearchableList (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Shared — wealth & account',
        items: [
            {
                id: 'comp-account-header-menu',
                label: 'AccountHeaderMenu (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-preferred-currency-display',
                label: 'PreferredAmount (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-wealth-chart',
                label: 'WealthChart (needs live query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-wealth-trend',
                label: 'WealthTrend (needs live query)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
]
