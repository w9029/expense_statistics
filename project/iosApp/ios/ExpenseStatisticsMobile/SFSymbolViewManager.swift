import UIKit
import React

@objc(SFSymbolViewManager)
class SFSymbolViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    SFSymbolView()
  }
}

final class SFSymbolView: UIView {
  @objc var name: NSString = "" {
    didSet { updateSymbol() }
  }

  @objc var pointSize: NSNumber = 16 {
    didSet { updateSymbol() }
  }

  @objc var weight: NSString = "regular" {
    didSet { updateSymbol() }
  }

  @objc var scale: NSString = "medium" {
    didSet { updateSymbol() }
  }

  @objc var colorHex: NSString = "#1f1b17" {
    didSet { updateTintColor() }
  }

  private let imageView = UIImageView()

  override init(frame: CGRect) {
    super.init(frame: frame)
    imageView.contentMode = .scaleAspectFit
    imageView.translatesAutoresizingMaskIntoConstraints = false
    addSubview(imageView)

    NSLayoutConstraint.activate([
      imageView.leadingAnchor.constraint(equalTo: leadingAnchor),
      imageView.trailingAnchor.constraint(equalTo: trailingAnchor),
      imageView.topAnchor.constraint(equalTo: topAnchor),
      imageView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    updateTintColor()
    updateSymbol()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    nil
  }

  private func updateSymbol() {
    let config = UIImage.SymbolConfiguration(
      pointSize: CGFloat(truncating: pointSize),
      weight: symbolWeight(from: weight as String),
      scale: symbolScale(from: scale as String)
    )

    imageView.image = UIImage(systemName: name as String, withConfiguration: config)
  }

  private func updateTintColor() {
    imageView.tintColor = UIColor(hex: colorHex as String) ?? .label
  }

  private func symbolWeight(from rawValue: String) -> UIImage.SymbolWeight {
    switch rawValue {
    case "ultraLight":
      return .ultraLight
    case "thin":
      return .thin
    case "light":
      return .light
    case "medium":
      return .medium
    case "semibold":
      return .semibold
    case "bold":
      return .bold
    case "heavy":
      return .heavy
    case "black":
      return .black
    default:
      return .regular
    }
  }

  private func symbolScale(from rawValue: String) -> UIImage.SymbolScale {
    switch rawValue {
    case "small":
      return .small
    case "large":
      return .large
    default:
      return .medium
    }
  }
}

private extension UIColor {
  convenience init?(hex: String) {
    let value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    guard value.count == 6, let number = Int(value, radix: 16) else {
      return nil
    }

    self.init(
      red: CGFloat((number >> 16) & 0xff) / 255,
      green: CGFloat((number >> 8) & 0xff) / 255,
      blue: CGFloat(number & 0xff) / 255,
      alpha: 1
    )
  }
}
