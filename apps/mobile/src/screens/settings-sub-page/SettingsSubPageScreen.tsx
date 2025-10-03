import { Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import { StaticScreenProps } from '@react-navigation/native';
import { useAppStore } from '@perawallet/core';

type SettingsSubPageScreenProps = StaticScreenProps<{
  title: string;
}>;

const SettingsSubPageScreen = ({ route }: SettingsSubPageScreenProps) => {
  const setTheme = useAppStore(state => state.setTheme)
  setTheme('light') //TODO: Remove this hack - it's only here so we can force the app into light mode
  return (
    <MainScreenLayout header fullScreen>
      <Text>This page would hold the settings for {route.params.title}</Text>
    </MainScreenLayout>
  );
};

export default SettingsSubPageScreen;
