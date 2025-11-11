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

import { useAppStore } from '@perawallet/core';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const useIsDarkMode = () => {
  const themeMode = useAppStore(state => state.theme);
  const scheme = useColorScheme();
  const isDarkMode = useMemo(() => {
    return (
      themeMode === 'dark' || (themeMode === 'system' && scheme === 'dark')
    );
  }, [themeMode, scheme]);

  return isDarkMode;
};
