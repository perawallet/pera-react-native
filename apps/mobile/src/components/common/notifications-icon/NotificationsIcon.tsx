import { useAppStore, useV1DevicesNotificationStatusList } from '@perawallet/core';
import BellIcon from '../../../../assets/icons/bell.svg';
import BellWithBadgeIcon from '../../../../assets/icons/bell-with-badge.svg';
import { SvgProps } from 'react-native-svg';
import { TouchableOpacity } from 'react-native';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type NotificationsIconProps = {
} & SvgProps;

const NotificationsIcon = (props: NotificationsIconProps) => {

  const deviceID = useAppStore(state => state.deviceID)
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const goToNotifications = () => {
    navigation.navigate('Notifications')
  }

  const { data } = useV1DevicesNotificationStatusList({
    device_id: deviceID!
  }, {
    query: {
      enabled: !!deviceID,
      staleTime: 30_000 //TODO make configurable or at least store somewhere sensible
    }
  })

  return <TouchableOpacity onPress={goToNotifications}>{
    data?.has_new_notification ? <BellWithBadgeIcon {...props} /> : <BellIcon {...props} />
  }</TouchableOpacity>
};

export default NotificationsIcon;
