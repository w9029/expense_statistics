import {Platform, View, requireNativeComponent} from 'react-native';
import type {ViewStyle} from 'react-native';
import {useI18n} from '@/features/i18n/i18n-context';

type NativeDateChangePayload =
  | {nativeEvent?: {value?: string | null} | null; value?: string | null}
  | string
  | null;

type NativeProps = {
  locale?: string;
  value?: string;
  placeholder?: string;
  mode?: 'date' | 'month';
  style?: ViewStyle;
  onDateChange?: (event: {nativeEvent: {value: string}}) => void;
};

const NativeDateFieldView =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>('DateFieldView')
    : null;

export function DateField({
  mode,
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
      mode={mode}
      onDateChange={(event: NativeDateChangePayload) => {
        const nextValue = extractDateFieldValue(event);
        if (!nextValue) {
          return;
        }

        onDateChange?.({nativeEvent: {value: nextValue}});
      }}
      placeholder={placeholder}
      style={style}
      value={value}
    />
  );
}

function extractDateFieldValue(event: NativeDateChangePayload) {
  if (typeof event === 'string') {
    return event;
  }

  if (typeof event?.nativeEvent?.value === 'string') {
    return event.nativeEvent.value;
  }

  if (typeof event?.value === 'string') {
    return event.value;
  }

  return null;
}
