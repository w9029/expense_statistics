import UIKit
import React

@objc(ClipboardModule)
class ClipboardModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(copyText:resolver:rejecter:)
  func copyText(
    _ text: NSString,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    UIPasteboard.general.string = text as String
    resolve(nil)
  }
}
