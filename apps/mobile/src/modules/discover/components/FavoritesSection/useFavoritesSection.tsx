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

import { useCallback, useMemo } from "react";
import { DiscoverEvent, trackEvent } from "@analytics";
import { useAppNavigation } from "@hooks/useAppNavigation";
import { useBottomSheet } from "@modules/bottom-sheet";
import {
  FolderNameSheet,
  type FolderNameSheetResult,
} from "../FolderNameSheet";
import { useDiscoverFavoritesStore } from "../../store/useDiscoverFavoritesStore";

/** Folder rows the home shows before "See all". */
export const HOME_FOLDER_LIMIT = 4;

export type FavoritesFolderRow = { id: string; name: string; count: number };

export type UseFavoritesSectionResult = {
  favoriteCount: number;
  /** Newest first, at most `HOME_FOLDER_LIMIT`. */
  folders: FavoritesFolderRow[];
  hasMore: boolean;
  /** No favorites and no folders. */
  isEmpty: boolean;
  openNewFolder: () => Promise<void>;
  openAllFavorites: () => void;
  openFolder: (id: string) => void;
  openAllFolders: () => void;
};

export const useFavoritesSection = (): UseFavoritesSectionResult => {
  const navigation = useAppNavigation();
  const { request } = useBottomSheet();
  const favoriteCount = useDiscoverFavoritesStore(
    (s) => s.favoriteOrder.length,
  );
  const folders = useDiscoverFavoritesStore((s) => s.folders);
  const folderOrder = useDiscoverFavoritesStore((s) => s.folderOrder);
  const createFolder = useDiscoverFavoritesStore((s) => s.createFolder);

  const rows = useMemo(
    () =>
      folderOrder.flatMap((id) => {
        const folder = folders[id];
        return folder
          ? [{ id, name: folder.name, count: folder.items.length }]
          : [];
      }),
    [folders, folderOrder],
  );

  const openNewFolder = useCallback(async () => {
    const name = await request<FolderNameSheetResult>({
      contents: <FolderNameSheet mode="create" />,
      options: { size: "auto", enablePanDownToClose: true },
    });
    if (name === undefined) return;
    createFolder(name);
    trackEvent(DiscoverEvent.FolderCreate);
  }, [request, createFolder]);

  const openAllFavorites = useCallback(() => {
    navigation.navigate("DiscoverAllFavorites");
  }, [navigation]);
  const openFolder = useCallback(
    (id: string) => {
      navigation.navigate("DiscoverFolder", { folderId: id });
    },
    [navigation],
  );
  const openAllFolders = useCallback(() => {
    navigation.navigate("DiscoverAllFolders");
  }, [navigation]);

  return {
    favoriteCount,
    folders: rows.slice(0, HOME_FOLDER_LIMIT),
    hasMore: rows.length > HOME_FOLDER_LIMIT,
    isEmpty: favoriteCount === 0 && rows.length === 0,
    openNewFolder,
    openAllFavorites,
    openFolder,
    openAllFolders,
  };
};
