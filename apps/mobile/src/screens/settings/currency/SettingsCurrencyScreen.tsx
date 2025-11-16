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

import { Input, Text, useTheme } from '@rneui/themed';
import MainScreenLayout from '../../../layouts/MainScreenLayout';

import { useStyles } from './styles';
import PWView from '../../../components/common/view/PWView';
import {
  CurrencySerializerResponse,
  useCurrency,
  useV1CurrenciesList,
} from '@perawallet/core';
import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import PWTouchableOpacity from '../../../components/common/touchable-opacity/PWTouchableOpacity';

import SearchIcon from '../../../../assets/icons/magnifying-glass.svg';

const SettingsCurrencyScreen = () => {
  const styles = useStyles();
  const { theme } = useTheme();
  const { preferredCurrency, setPreferredCurrency } = useCurrency();
  const [search, setSearch] = useState<string>();
  const [filteredData, setFilteredData] = useState<
    CurrencySerializerResponse[]
  >([]);

  const { data } = useV1CurrenciesList({});

  useEffect(() => {
    if (!search?.length) {
      setFilteredData(data ?? []);
    } else {
      const lowercaseSearch = search.toLowerCase();
      setFilteredData(
        (data ?? []).filter(
          d =>
            d.name.toLowerCase().includes(lowercaseSearch) ||
            d.currency_id.toLowerCase().includes(lowercaseSearch),
        ),
      );
    }
  }, [data, search]);

  const renderItem = ({ item }: { item: CurrencySerializerResponse }) => {
    return (
      <PWTouchableOpacity
        onPress={() => setPreferredCurrency(item.currency_id)}
        style={styles.row}
      >
        <Text h4>
          {item.name} ({item.currency_id})
        </Text>
        <PWView style={styles.radioContainer}>
          {preferredCurrency === item.currency_id && (
            <PWView style={styles.selectedRadio} />
          )}
        </PWView>
      </PWTouchableOpacity>
    );
  };

  return (
    <MainScreenLayout>
      <PWView style={styles.container}>
        <Text h3>Main Currency</Text>
        <Text>
          Select a currency as your main local currency for displaying asset
          values.
        </Text>
        <Input
          placeholder="Search"
          inputContainerStyle={styles.input}
          value={search}
          onChangeText={setSearch}
          leftIcon={<SearchIcon color={theme.colors.textGray} />}
        />
        <FlatList data={filteredData} renderItem={renderItem} />
      </PWView>
    </MainScreenLayout>
  );
};

export default SettingsCurrencyScreen;
