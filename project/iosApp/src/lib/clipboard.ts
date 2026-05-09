import {NativeModules, Platform, Share} from 'react-native';

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

  await Share.share({
    message: text,
    url: text,
  });
}
