import { Text } from '@rneui/themed';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import { StaticScreenProps } from '@react-navigation/native';

type SettingsSubPageScreenProps = StaticScreenProps<{
  title: string;
}>;

const SettingsSubPageScreen = ({ route }: SettingsSubPageScreenProps) => {
  return (
    <MainScreenLayout header fullScreen>
      <Text>This page would hold the settings for {route.params.title}</Text>
    </MainScreenLayout>
  );
};

export default SettingsSubPageScreen;
