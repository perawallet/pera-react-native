import { View, ViewProps } from 'react-native';
import { useStyles } from './MainScreenLayout.style';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import PeraView from '../components/common/view/PeraView';
import { useNavigation } from '@react-navigation/native';

import ChevronLeft from '../../assets/icons/chevron-left.svg';
import { Text, useTheme } from '@rneui/themed';

export type MainScreenLayoutProps = {
  fullScreen?: boolean;
  showBack?: boolean;
  title?: string;
  header?: boolean;
} & ViewProps;

export type MainScreenLayoutPropsWithInsets = {
  insets: EdgeInsets;
} & MainScreenLayoutProps;

const MainScreenLayout = (props: MainScreenLayoutProps) => {
  const insets = useSafeAreaInsets();
  const styles = useStyles({ ...props, insets });
  const { theme } = useTheme();
  const navigation = useNavigation();

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <PeraView style={[props.style, styles.mainContainer]} {...props}>
      <View style={styles.contentContainer}>
        {props.showBack && (
          <ChevronLeft
            stroke={theme.colors.textMain}
            onPress={goBack}
            style={styles.backContainer}
          />
        )}
        {props.title && (
          <Text h1 style={styles.title}>
            {props.title}
          </Text>
        )}

        {props.children}
      </View>
    </PeraView>
  );
};

export default MainScreenLayout;
