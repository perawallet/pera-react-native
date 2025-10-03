import { makeStyles } from '@rneui/themed';
import { MainScreenLayoutPropsWithInsets } from './MainScreenLayout';

export const useStyles = makeStyles(
  (theme, props: MainScreenLayoutPropsWithInsets) => {
    const { insets, fullScreen } = props;
    return {
      mainContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: 0,
      },
      testnetContainer: {
        backgroundColor: theme.colors.primary,
        height: theme.spacing.lg * 2,
      },
      backContainer: {
        paddingVertical: theme.spacing.sm,
      },
      title: {
        marginVertical: theme.spacing.lg,
      },
      contentContainer: {
        flex: 1,
        paddingLeft: fullScreen ? 0 : insets.left + theme.spacing.xl,
        paddingRight: fullScreen ? 0 : insets.right + theme.spacing.xl,
        paddingTop: theme.spacing.xl,
        paddingBottom: fullScreen ? 0 : insets.bottom + theme.spacing.xl,
      },
    };
  },
);
