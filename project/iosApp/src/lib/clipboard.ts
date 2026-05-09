import {NativeModules, Platform} from 'react-native';

type ClipboardModuleShape = {
  copyText?: (text: string) => Promise<void>;
};

const {ClipboardModule} = NativeModules as {
  ClipboardModule?: ClipboardModuleShape;
};

export async function copyText(text: string) {
  if (
    Platform.OS === 'ios' &&
    ClipboardModule &&
    typeof ClipboardModule.copyText === 'function'
  ) {
    await ClipboardModule.copyText(text);
    return;
  }

  throw new Error('ClipboardModule unavailable');
}
