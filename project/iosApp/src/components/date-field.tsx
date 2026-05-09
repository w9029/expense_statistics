import {Platform, View, requireNativeComponent} from 'react-native';
import type {ViewStyle} from 'react-native';
import {useI18n} from '@/features/i18n/i18n-context';

type NativeProps = {
  locale?: string;
  value?: string;
  placeholder?: string;
  style?: ViewStyle;
  onDateChange?: (event: {nativeEvent: {value: string}}) => void;
};

const NativeDateFieldView =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>('DateFieldView')
    : null;

export function DateField({
  onDateChange,
  placeholder,
  style,
  value,
}: NativeProps) {
  const {language} = useI18n();

  if (!NativeDateFieldView) {
    return <View style={style} />;
  }

  return (
    <NativeDateFieldView
      locale={language}
      onDateChange={onDateChange}
      placeholder={placeholder}
      style={style}
      value={value}
    />
  );
}
