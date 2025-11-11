import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

export type PWTouchableOpacityProps = {} & TouchableOpacityProps;

const DEFAULT_ACTIVE_OPACITY = 0.8;

const PWTouchableOpacity = ({
  children,
  activeOpacity,
  ...rest
}: PWTouchableOpacityProps) => {
  return (
    <TouchableOpacity
      {...rest}
      activeOpacity={activeOpacity ?? DEFAULT_ACTIVE_OPACITY}
    >
      {children}
    </TouchableOpacity>
  );
};

export default PWTouchableOpacity;
