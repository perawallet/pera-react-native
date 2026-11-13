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

import type { ReactElement } from "react";
import {
  PWButton,
  PWFlatList,
  PWIcon,
  PWScreen,
  PWText,
  PWTouchableOpacity,
  PWView,
} from "@components/core";
import { ChainNotice } from "@components/ChainNotice";
import { FilterSelection } from "@components/FilterSelection";
import { LoadingView } from "@components/LoadingView";
import { SearchInput } from "@components/SearchInput";
import { useLanguage } from "@hooks/useLanguage";
import { AssetItemView } from "@modules/assets";
import type { DisplayableAsset } from "@perawallet/wallet-core-assets";
import { DappRow } from "../../components/DappRow";
import type { RecentSearch } from "../../store/useDiscoverRecentSearchesStore";
import { dappHostOf } from "../../utils/normalizeDappUrl";
import { dappFromUrl } from "../../utils/toDiscoverDapp";
import { toSearchRows, type SearchRow } from "./searchRows";
import { useStyles } from "./styles";
import { useDiscoverSearchScreen } from "./useDiscoverSearchScreen";

const LOADING_ROW_COUNT = 3;

export const DiscoverSearchScreen = () => {
  const styles = useStyles();
  const { t } = useLanguage();
  const search = useDiscoverSearchScreen();
  const rows = toSearchRows(search);

  const renderLinkRow = ({
    testID,
    icon,
    title,
    subtitle,
    onPress,
  }: {
    testID: string;
    icon: "globe" | "magnifying-glass";
    title: string;
    subtitle: string;
    onPress: () => void;
  }): ReactElement => (
    <PWTouchableOpacity
      style={styles.linkRow}
      onPress={onPress}
      testID={testID}
    >
      <PWView style={styles.linkIcon}>
        <PWIcon name={icon} variant="secondary" />
      </PWView>
      <PWView style={styles.linkInfo}>
        <PWText variant="h4" numberOfLines={1}>
          {title}
        </PWText>
        <PWText variant="caption" numberOfLines={1} style={styles.linkSubtitle}>
          {subtitle}
        </PWText>
      </PWView>
    </PWTouchableOpacity>
  );

  const renderRecent = (
    recent: RecentSearch,
    recentKey: string,
  ): ReactElement => {
    const testID = `discover_search_recent_${recentKey}`;
    switch (recent.kind) {
      case "url": {
        return renderLinkRow({
          testID,
          icon: "globe",
          title: dappHostOf(recent.url),
          subtitle: recent.url,
          onPress: () => search.openRecent(recent),
        });
      }
      case "dapp": {
        return (
          <DappRow
            dapp={recent.dapp}
            subtitle={dappHostOf(recent.dapp.url)}
            isFavorite={search.isFavorite(recent.dapp.url)}
            isVerified={search.isVerified(recent.dapp.url)}
            showChains={search.showChains}
            onPress={() => search.openRecent(recent)}
            onToggleFavorite={() => search.toggleFavorite(recent.dapp)}
            testID={testID}
          />
        );
      }
      case "asset": {
        const asset: DisplayableAsset = {
          assetId: recent.ref.assetId,
          name: recent.name,
          unitName: recent.unitName,
          peraMetadata: { logo: recent.logo },
        };
        return (
          <AssetItemView
            asset={asset}
            chainId={recent.ref.chainId}
            showChainBadge={search.showChains}
            onPress={() => search.openRecent(recent)}
            testID={testID}
          />
        );
      }
    }
  };

  const renderRow = ({ item }: { item: SearchRow }): ReactElement => {
    switch (item.kind) {
      case "recentHeader": {
        return (
          <PWView style={styles.sectionHeader}>
            <PWText variant="h4" testID="discover_search_recent_title">
              {t("discover.search.recent_title")}
            </PWText>
            <PWButton
              variant="link"
              paddingStyle="none"
              title={t("discover.search.clear_all")}
              onPress={search.clearRecents}
              testID="discover_search_clear_all"
            />
          </PWView>
        );
      }
      case "noRecent": {
        return (
          <PWText style={styles.emptyText} testID="discover_search_no_recent">
            {t("discover.search.no_recent")}
          </PWText>
        );
      }
      case "recent": {
        return renderRecent(item.recent, item.recentKey);
      }
      case "typedUrl": {
        const dapp = dappFromUrl(item.url);
        if (dapp === null) return <></>;
        return (
          <DappRow
            dapp={dapp}
            subtitle={item.url}
            isFavorite={search.isFavorite(item.url)}
            isVerified={search.isVerified(item.url)}
            showChains={false}
            onPress={search.openTypedUrl}
            onToggleFavorite={search.toggleTypedUrlFavorite}
            testID="discover_search_typed_url"
          />
        );
      }
      case "webSearch": {
        return renderLinkRow({
          testID: "discover_search_web_row",
          icon: "magnifying-glass",
          title: t("discover.search.search_web"),
          subtitle: search.query.trim(),
          onPress: search.openWebSearch,
        });
      }
      case "dapp": {
        return (
          <DappRow
            dapp={item.dapp}
            subtitle={dappHostOf(item.dapp.url)}
            isFavorite={search.isFavorite(item.dapp.url)}
            isVerified={search.isVerified(item.dapp.url)}
            showChains={search.showChains}
            onPress={() => search.openDapp(item.dapp)}
            onToggleFavorite={() => search.toggleFavorite(item.dapp)}
            testID={`discover_search_dapp_${item.dapp.url}`}
          />
        );
      }
      case "asset": {
        return (
          <AssetItemView
            asset={item.result.asset}
            chainId={item.result.scope.chainId}
            showChainBadge={search.showChains}
            onPress={() => search.openAsset(item.result)}
          />
        );
      }
      case "incomplete": {
        return (
          <ChainNotice
            kind="warning"
            titleKey="add_asset.partial_results"
            style={styles.notice}
            testID="discover_search_partial_results"
          />
        );
      }
      case "unavailable": {
        return (
          <ChainNotice
            kind="warning"
            titleKey="discover.search.assets_unavailable"
            style={styles.notice}
            testID="discover_search_assets_unavailable"
          />
        );
      }
      case "dappsUnavailable": {
        return (
          <ChainNotice
            kind="warning"
            titleKey="discover.search.dapps_unavailable"
            style={styles.notice}
            testID="discover_search_dapps_unavailable"
          />
        );
      }
      case "noResults": {
        return (
          <PWText style={styles.emptyText} testID="discover_search_no_results">
            {t("discover.search.no_results")}
          </PWText>
        );
      }
      case "loading": {
        return (
          <PWView testID="discover_search_loading">
            <LoadingView
              variant="skeleton"
              size="sm"
              count={LOADING_ROW_COUNT}
            />
          </PWView>
        );
      }
    }
  };

  return (
    <PWScreen scroll="never" testID="discover_search_screen">
      <PWView style={styles.header}>
        <SearchInput
          value={search.query}
          onChangeText={search.setQuery}
          placeholder={t("discover.search.placeholder")}
          containerStyle={styles.searchContainer}
          inputContainerStyle={styles.searchField}
          returnKeyType="search"
          onSubmitEditing={search.submit}
          testID="discover_search_input"
          autoFocus
        />
        <PWButton
          variant="link"
          paddingStyle="none"
          title={t("common.cancel.label")}
          onPress={search.cancel}
          testID="discover_search_cancel"
        />
      </PWView>
      {search.isTyping ? (
        // Wrapped so the horizontal ScrollView keeps its content
        // height instead of growing against the list below.
        <PWView>
          <FilterSelection
            options={search.filterOptions}
            selectedValue={search.filter}
            onSelect={search.setFilter}
            contentContainerStyle={styles.filters}
            testID="discover_search_filters"
          />
        </PWView>
      ) : null}
      <PWFlatList
        data={rows}
        renderItem={renderRow}
        keyExtractor={(row) => row.key}
        // Rows differ in kind and carry their own spacing.
        ItemSeparatorComponent={null}
        style={styles.list}
        contentContainerStyle={styles.contentContainer}
      />
    </PWScreen>
  );
};
