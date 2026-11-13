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

import type { ChainId } from "@perawallet/wallet-core-chain-contract";
import type { AnalyticsMetadataKey as Key } from "../metadata-keys";

/** Native Discover home, search, dApp directory and favorites. Names match the web app. */
export enum DiscoverEvent {
  SearchBarTap = "disover_search_bar_tap", // sic, the web app's spelling
  SearchResultTap = "discover_search_result_tap",
  DappOpenTap = "discover_dapp_open_tap",
  DappFavoriteTap = "discover_dapp_favorite_tap",
  DappUnfavoriteTap = "discover_dapp_unfavorite_tap",
  DappFilterTap = "discover_dapp_filter_tap",
  NewsButtonTap = "discover_news_button_tap",
  NewsOpenTap = "discover_news_open_tap",
  TopDappsButtonTap = "discover_top_dapps_button_tap",
  ApplyForVerificationTap = "discover_apply_for_verification",
  DappCategoryTap = "discover_dapp_category_tap",
  DappDetailsButtonTap = "discover_dapp_details_button_tap",
  DetailsCloseTap = "discover_details_close_tap", // sic, the web app's name
  FolderCreate = "discover_folder_create",
}

type DappPayload = {
  [Key.DappName]: string;
  [Key.DappUrl]: string;
  [Key.ChainId]?: ChainId;
};

export interface DiscoverRequiredPayloads {
  [DiscoverEvent.DappOpenTap]: DappPayload;
  [DiscoverEvent.DappFavoriteTap]: DappPayload;
  [DiscoverEvent.DappUnfavoriteTap]: DappPayload;
  [DiscoverEvent.DappFilterTap]: {
    [Key.FilterName]: string;
    [Key.ChainId]?: ChainId;
  };
  [DiscoverEvent.NewsOpenTap]: { [Key.NewsTitle]: string };
  [DiscoverEvent.ApplyForVerificationTap]: { [Key.Category]: "project" };
  [DiscoverEvent.DappCategoryTap]: {
    [Key.CategoryName]: string;
    [Key.ChainId]?: ChainId;
  };
  [DiscoverEvent.DappDetailsButtonTap]: {
    [Key.DappName]: string;
    [Key.ChainId]?: ChainId;
  };
  [DiscoverEvent.DetailsCloseTap]: {
    [Key.DappName]: string;
    [Key.ChainId]?: ChainId;
  };
}

export interface DiscoverOptionalPayloads {
  [DiscoverEvent.SearchResultTap]: {
    [Key.DappName]?: string;
    [Key.DappUrl]?: string;
    [Key.AssetId]?: string;
    [Key.ChainId]?: ChainId;
  };
}
