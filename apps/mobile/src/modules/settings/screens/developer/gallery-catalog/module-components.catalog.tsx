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

import { PWView } from '@components/core'

// ─── accounts module ──────────────────────────────────────────────────────────
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { CollectibleGridItem as AccountsCollectibleGridItem } from '@modules/accounts/components/CollectibleGridItem'
import { CollectibleListItem as AccountsCollectibleListItem } from '@modules/accounts/components/CollectibleListItem'
import { CollectibleThumbnail as AccountsCollectibleThumbnail } from '@modules/accounts/components/CollectibleThumbnail'
import { ConfettiAnimation } from '@modules/accounts/components/ConfettiAnimation'
import { NftEmptyState } from '@modules/accounts/components/NftEmptyState'
import { SelectableAccountCheckboxRow } from '@modules/accounts/components/SelectableAccountCheckboxRow'

// ─── assets module ────────────────────────────────────────────────────────────
import { AssetFavoriteButton } from '@modules/assets/components/AssetFavoriteButton'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { AssetNameBadge } from '@modules/assets/components/AssetNameBadge'
import { AssetNotificationButton } from '@modules/assets/components/AssetNotificationButton'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import { AssetSelection } from '@modules/assets/components/AssetSelection'
import { AssetTierChip } from '@modules/assets/components/AssetTierChip'
import { AssetTitle } from '@modules/assets/components/AssetTitle'
import { CollectibleGridItem as AssetsCollectibleGridItem } from '@modules/assets/components/CollectibleGridItem'
import { CollectibleListItem as AssetsCollectibleListItem } from '@modules/assets/components/CollectibleListItem'
import { CollectibleThumbnail as AssetsCollectibleThumbnail } from '@modules/assets/components/CollectibleThumbnail'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem'

// ─── transactions module ──────────────────────────────────────────────────────
import { TransactionDateHeader } from '@modules/transactions/components/TransactionDateHeader'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import { TransactionListItem } from '@modules/transactions/components/TransactionListItem'
import { TransactionStatusBadge } from '@modules/transactions/components/TransactionStatusBadge'

// ─── swap module ──────────────────────────────────────────────────────────────
import { SwapAssetPairIcon } from '@modules/swap/components/SwapAssetPairIcon'
import { SwapProviderDisplay } from '@modules/swap/components/SwapProviderDisplay'
import { SwapProviderRow } from '@modules/swap/components/SwapProviderRow'
import { SwapQuoteDetails } from '@modules/swap/components/SwapQuoteDetails'

// ─── signing module ───────────────────────────────────────────────────────────
import { SourceMetadataBadge } from '@modules/signing/components/SourceMetadataBadge'
import { SourceMetadataView } from '@modules/signing/components/SourceMetadataView'

// ─── multisig module ──────────────────────────────────────────────────────────
import { ParticipantListItem } from '@modules/multisig/components/ParticipantListItem'
import { SignerStatusListItem } from '@modules/multisig/components/SignerStatusListItem'
import { ThresholdStepper } from '@modules/multisig/components/ThresholdStepper'

// ─── staking module ───────────────────────────────────────────────────────────
import { StakingProjectCard } from '@modules/staking/components/StakingProjectCard'
import { StakingTypeBadge } from '@modules/staking/components/StakingTypeBadge'

import {
    mockAlgo25Account,
    mockAsset,
    mockCollectible,
    mockTransaction,
    MOCK_ASSET_ID,
    MOCK_ADDRESS,
} from '@perawallet/wallet-core-dev-fixtures'

import { registerPreview } from './registry'

import type { GallerySection } from './types'
import type { DexSwapAsset, SwapQuote } from '@perawallet/wallet-core-swaps'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import type { StakingProject } from '@perawallet/wallet-core-staking'

// ─── Accounts (module) ────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-account-display',
    render: () => (
        <AccountDisplay
            account={mockAlgo25Account}
            showChevron={false}
        />
    ),
})

registerPreview({
    id: 'comp-account-icon',
    render: () => (
        <PWView>
            <AccountIcon
                account={mockAlgo25Account}
                size='md'
            />
            <AccountIcon
                account={mockAlgo25Account}
                size='lg'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-accounts-collectible-grid-item',
    render: () => (
        <AccountsCollectibleGridItem
            asset={mockCollectible}
            amount={new Decimal('1')}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-accounts-collectible-list-item',
    render: () => (
        <AccountsCollectibleListItem
            asset={mockCollectible}
            amount={new Decimal('3')}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-accounts-collectible-thumbnail',
    render: () => (
        <PWView>
            <AccountsCollectibleThumbnail
                thumbnailUrl='https://perawallet.app/static/nft-thumb.png'
                imageStyle={{ width: 80, height: 80 }}
                placeholderStyle={{ width: 80, height: 80 }}
                iconSize='md'
            />
            <AccountsCollectibleThumbnail
                thumbnailUrl={null}
                imageStyle={{ width: 80, height: 80 }}
                placeholderStyle={{ width: 80, height: 80 }}
                iconSize='md'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-confetti-animation',
    render: () => (
        <ConfettiAnimation
            play={true}
            onFinish={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-nft-empty-state',
    render: () => (
        <NftEmptyState onOptInPress={() => undefined} />
    ),
})

registerPreview({
    id: 'comp-selectable-account-checkbox-row',
    render: () => (
        <PWView>
            <SelectableAccountCheckboxRow
                title={mockAlgo25Account.name ?? 'Mock Algo25 Account'}
                subtitle={mockAlgo25Account.address}
                isSelected={true}
                onToggle={() => undefined}
            />
            <SelectableAccountCheckboxRow
                title='Unselected Account'
                subtitle='ABCDE...FGHIJ'
                isSelected={false}
                onToggle={() => undefined}
                isImported={false}
            />
        </PWView>
    ),
})

// ─── Assets (module) ─────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-asset-icon',
    render: () => (
        <PWView>
            <AssetIcon
                asset={mockAsset}
                size='sm'
            />
            <AssetIcon
                asset={mockAsset}
                size='md'
            />
            <AssetIcon
                asset={mockAsset}
                size='lg'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-name-badge',
    render: () => (
        <PWView>
            <AssetNameBadge
                name='USD Coin'
                verificationTier='verified'
                isFavorited={false}
                textVariant='h4'
            />
            <AssetNameBadge
                name='Suspicious Token'
                verificationTier='suspicious'
                isFavorited={true}
                textVariant='body'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-tier-chip',
    render: () => (
        <PWView>
            <AssetTierChip
                unitName='USDC'
                verificationTier='verified'
                size='sm'
            />
            <AssetTierChip
                unitName='USDC'
                verificationTier='verified'
                size='md'
            />
            <AssetTierChip
                unitName='ALGO'
                verificationTier='unverified'
                size='sm'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-title',
    render: () => (
        <AssetTitle
            asset={mockAsset}
            showId={true}
        />
    ),
})

registerPreview({
    id: 'comp-asset-favorite-button',
    render: () => (
        <PWView>
            <AssetFavoriteButton
                assetId={MOCK_ASSET_ID}
                isFavorite={false}
            />
            <AssetFavoriteButton
                assetId={MOCK_ASSET_ID}
                isFavorite={true}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-notification-button',
    render: () => (
        <PWView>
            <AssetNotificationButton
                assetId={MOCK_ASSET_ID}
                isNotificationsEnabled={false}
            />
            <AssetNotificationButton
                assetId={MOCK_ASSET_ID}
                isNotificationsEnabled={true}
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-asset-search-item',
    render: () => (
        <AssetSearchItem
            item={{
                assetId: MOCK_ASSET_ID,
                name: 'USD Coin',
                unitName: 'USDC',
                logo: 'https://perawallet.app/static/usdc-logo.png',
                verificationTier: 'verified',
                usdValue: '1.00',
                type: 'standard_asset',
                collectibleTitle: null,
                collectibleImage: null,
                collectionName: null,
            }}
            isOptedIn={false}
            isOptingIn={false}
            onAdd={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-asset-selection',
    render: () => (
        <AssetSelection asset={mockAsset} />
    ),
})

registerPreview({
    id: 'comp-assets-collectible-grid-item',
    render: () => (
        <AssetsCollectibleGridItem
            item={{
                assetId: mockCollectible.assetId,
                asset: mockCollectible,
                amount: new Decimal('1'),
            }}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-assets-collectible-list-item',
    render: () => (
        <AssetsCollectibleListItem
            item={{
                assetId: mockCollectible.assetId,
                asset: mockCollectible,
                amount: new Decimal('2'),
            }}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-assets-collectible-thumbnail',
    render: () => (
        <PWView>
            <AssetsCollectibleThumbnail
                thumbnailUrl='https://perawallet.app/static/nft-thumb.png'
                imageStyle={{ width: 80, height: 80 }}
                placeholderStyle={{ width: 80, height: 80 }}
                iconSize='md'
            />
            <AssetsCollectibleThumbnail
                thumbnailUrl={null}
                imageStyle={{ width: 80, height: 80 }}
                placeholderStyle={{ width: 80, height: 80 }}
                iconSize='md'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-account-asset-item-view',
    render: () => (
        <AccountAssetItemView
            accountBalance={{
                assetId: MOCK_ASSET_ID,
                asset: mockAsset,
                amount: new Decimal('1234.56'),
                algoValue: new Decimal('120.0'),
            }}
            usdPrice={new Decimal('1.00')}
            showBalance={true}
        />
    ),
})

// ─── Transactions (module) ────────────────────────────────────────────────────

registerPreview({
    id: 'comp-transaction-date-header',
    render: () => (
        <TransactionDateHeader title='May 25, 2025' />
    ),
})

registerPreview({
    id: 'comp-transaction-icon',
    render: () => (
        <PWView>
            <TransactionIcon
                type='payment'
                size='sm'
            />
            <TransactionIcon
                type='swap'
                size='md'
            />
            <TransactionIcon
                type='receive'
                size='lg'
            />
            <TransactionIcon
                type='asset-opt-in'
                size='sm'
            />
        </PWView>
    ),
})

registerPreview({
    id: 'comp-transaction-list-item',
    render: () => (
        <TransactionListItem
            transaction={mockTransaction}
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-transaction-status-badge',
    render: () => (
        <PWView>
            <TransactionStatusBadge status='completed' />
            <TransactionStatusBadge status='pending' />
            <TransactionStatusBadge status='failed' />
        </PWView>
    ),
})

// ─── Swap (module) ────────────────────────────────────────────────────────────

const mockDexAssetAlgo: DexSwapAsset = {
    assetId: '0',
    name: 'Algorand',
    unitName: 'ALGO',
    decimals: 6,
    verificationTier: 'verified',
}

const mockDexAssetUsdc: DexSwapAsset = {
    assetId: '31566704',
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
    verificationTier: 'verified',
}

const mockSwapQuote: SwapQuote = {
    provider: 'Tinyman',
    providerDisplayName: 'Tinyman',
    assetIn: mockDexAssetAlgo,
    assetOut: mockDexAssetUsdc,
    amountIn: new Decimal('5000000'),
    amountOut: new Decimal('4850000'),
    price: new Decimal('0.97'),
    priceImpact: new Decimal('0.01'),
    peraFeeAmount: new Decimal('50000'),
    slippage: new Decimal('0.005'),
}

registerPreview({
    id: 'comp-swap-asset-pair-icon',
    render: () => (
        <SwapAssetPairIcon
            assetIn={mockDexAssetAlgo}
            assetOut={mockDexAssetUsdc}
            surfaceColor='#ffffff'
        />
    ),
})

registerPreview({
    id: 'comp-swap-provider-display',
    render: () => (
        <SwapProviderDisplay
            providerName='Tinyman'
            providerDisplayName='Tinyman'
        />
    ),
})

registerPreview({
    id: 'comp-swap-provider-row',
    render: () => (
        <SwapProviderRow
            quote={mockSwapQuote}
            selectionMode='auto'
            onPress={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-swap-quote-details',
    render: () => (
        <SwapQuoteDetails
            quote={mockSwapQuote}
            isLoading={false}
        />
    ),
})

// ─── Signing (module) ─────────────────────────────────────────────────────────

const mockSignRequestSource: SignRequestSource = {
    name: 'Pera Demo DApp',
    description: 'A sample decentralized application',
    url: 'https://demo.perawallet.app',
    icons: ['https://demo.perawallet.app/icon.png'],
}

registerPreview({
    id: 'comp-source-metadata-badge',
    render: () => (
        <SourceMetadataBadge metadata={mockSignRequestSource} />
    ),
})

registerPreview({
    id: 'comp-source-metadata-view',
    render: () => (
        <SourceMetadataView metadata={mockSignRequestSource} />
    ),
})

// ─── Multisig (module) ────────────────────────────────────────────────────────

registerPreview({
    id: 'comp-threshold-stepper',
    render: () => (
        <ThresholdStepper
            value={2}
            min={1}
            max={4}
            onIncrement={() => undefined}
            onDecrement={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-participant-list-item',
    render: () => (
        <ParticipantListItem
            participant={{ address: MOCK_ADDRESS, name: 'Alice' }}
            index={0}
            isInWallet={false}
            onEdit={() => undefined}
            onRemove={() => undefined}
        />
    ),
})

registerPreview({
    id: 'comp-signer-status-list-item',
    render: () => (
        <SignerStatusListItem
            address={MOCK_ADDRESS}
            status='signed'
        />
    ),
})

// ─── Staking (module) ─────────────────────────────────────────────────────────

const mockStakingProject: StakingProject = {
    id: 'mock-staking-project',
    title: 'Folks Finance',
    description: 'Liquid staking on Algorand',
    logoUrl: 'https://perawallet.app/static/folks-finance.png',
    link: 'https://folks.finance',
    type: 'liquid',
    tvlInAlgo: new Decimal('12500000'),
    tvlInUsd: new Decimal('3750000'),
}

registerPreview({
    id: 'comp-staking-type-badge',
    render: () => (
        <StakingTypeBadge type='liquid' />
    ),
})

registerPreview({
    id: 'comp-staking-project-card',
    render: () => (
        <StakingProjectCard
            project={mockStakingProject}
            isLast={false}
            onPress={() => undefined}
        />
    ),
})

// ─── Sections ─────────────────────────────────────────────────────────────────

export const getModuleComponentSections = (): GallerySection[] => [
    {
        title: 'Accounts (module)',
        items: [
            {
                id: 'comp-account-display',
                label: 'AccountDisplay',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-account-icon',
                label: 'AccountIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-account-info-card',
                label: 'AccountInfoCard (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-with-balance',
                label: 'AccountWithBalance (needs live balances query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-overview',
                label: 'AccountOverview (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-selection',
                label: 'AccountSelection (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-backup-reminder-banner',
                label: 'BackupReminderBanner (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-button-panel',
                label: 'ButtonPanel (needs navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-accounts-collectible-grid-item',
                label: 'CollectibleGridItem (accounts)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-accounts-collectible-list-item',
                label: 'CollectibleListItem (accounts)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-accounts-collectible-thumbnail',
                label: 'CollectibleThumbnail (accounts)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-confetti-animation',
                label: 'ConfettiAnimation',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-nft-empty-state',
                label: 'NftEmptyState',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-no-funds-button-panel',
                label: 'NoFundsButtonPanel (needs navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-portfolio-view',
                label: 'PortfolioView (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-selectable-account-checkbox-row',
                label: 'SelectableAccountCheckboxRow',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-selectable-account-row',
                label: 'SelectableAccountRow (needs live balances query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-watch-account-button-panel',
                label: 'WatchAccountButtonPanel (needs navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-asset-list',
                label: 'AccountAssetList (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-history',
                label: 'AccountHistory (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-nfts',
                label: 'AccountNfts (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-account-menu',
                label: 'AccountMenu (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Assets (module)',
        items: [
            {
                id: 'comp-account-asset-selection-list',
                label: 'AccountAssetSelectionList (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-add-asset-view',
                label: 'AddAssetView (needs live query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-asset-favorite-button',
                label: 'AssetFavoriteButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-icon',
                label: 'AssetIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-account-asset-item-view',
                label: 'AccountAssetItemView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-name-badge',
                label: 'AssetNameBadge',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-notification-button',
                label: 'AssetNotificationButton',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-search-item',
                label: 'AssetSearchItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-selection',
                label: 'AssetSelection',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-tier-chip',
                label: 'AssetTierChip',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-asset-title',
                label: 'AssetTitle',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-assets-collectible-grid-item',
                label: 'CollectibleGridItem (assets)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-assets-collectible-list-item',
                label: 'CollectibleListItem (assets)',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-assets-collectible-thumbnail',
                label: 'CollectibleThumbnail (assets)',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Transactions (module)',
        items: [
            {
                id: 'comp-transaction-date-header',
                label: 'TransactionDateHeader',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-display',
                label: 'TransactionDisplay (needs live transaction data)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-transaction-icon',
                label: 'TransactionIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-list-item',
                label: 'TransactionListItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-status-badge',
                label: 'TransactionStatusBadge',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Swap (module)',
        items: [
            {
                id: 'comp-swap-amount-section',
                label: 'SwapAmountSection (needs live swap store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-asset-pair-icon',
                label: 'SwapAssetPairIcon',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-asset-selector',
                label: 'SwapAssetSelector (needs live assets query)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-form',
                label: 'SwapForm (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-history-list',
                label: 'SwapHistoryList (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-pair-history-widget',
                label: 'SwapPairHistoryWidget (needs live store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-provider-display',
                label: 'SwapProviderDisplay',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-provider-row',
                label: 'SwapProviderRow',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-quote-details',
                label: 'SwapQuoteDetails',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-swap-to-asset-selection-list',
                label: 'SwapToAssetSelectionList (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-swap-top-pairs',
                label: 'SwapTopPairs (needs live state)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Signing (module)',
        items: [
            {
                id: 'comp-arbitrary-data-signing-view',
                label: 'ArbitraryDataSigningView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-arc60-data-signing-view',
                label: 'Arc60DataSigningView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-fee-display',
                label: 'FeeDisplay (needs signing + navigation context)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-multiple-arbitrary-sign-request-view',
                label: 'MultipleArbitrarySignRequestView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-sign-request-view',
                label: 'SignRequestView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-signing-account-display',
                label: 'SigningAccountDisplay (needs live accounts store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-signing-action-buttons',
                label: 'SigningActionButtons (needs signing pipeline)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-signing-warnings',
                label: 'SigningWarnings (needs signing pipeline)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-single-arbitrary-sign-request-view',
                label: 'SingleArbitrarySignRequestView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-source-metadata-badge',
                label: 'SourceMetadataBadge',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-source-metadata-view',
                label: 'SourceMetadataView',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-transaction-signing-view',
                label: 'TransactionSigningView (needs live signing state)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-transaction-summary-header',
                label: 'TransactionSummaryHeader (needs PeraDisplayableTransaction)',
                launch: { kind: 'action', run: () => undefined },
            },
        ],
    },
    {
        title: 'Multisig (module)',
        items: [
            {
                id: 'comp-multisig-decline-button',
                label: 'MultisigDeclineButton (needs signing store)',
                launch: { kind: 'action', run: () => undefined },
            },
            {
                id: 'comp-participant-list-item',
                label: 'ParticipantListItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-signer-status-list-item',
                label: 'SignerStatusListItem',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-threshold-stepper',
                label: 'ThresholdStepper',
                launch: { kind: 'preview' },
            },
        ],
    },
    {
        title: 'Staking (module)',
        items: [
            {
                id: 'comp-staking-project-card',
                label: 'StakingProjectCard',
                launch: { kind: 'preview' },
            },
            {
                id: 'comp-staking-type-badge',
                label: 'StakingTypeBadge',
                launch: { kind: 'preview' },
            },
        ],
    },
]
