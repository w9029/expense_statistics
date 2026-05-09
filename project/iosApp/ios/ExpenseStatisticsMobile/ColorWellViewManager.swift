import UIKit
import React

@objc(ColorWellViewManager)
class ColorWellViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    ColorWellView()
  }
}

final class ColorWellView: UIView {
  @objc var colorHex: NSString = "#CA5D2B" {
    didSet { updateColor() }
  }

  @objc var onColorChange: RCTBubblingEventBlock?

  private let colorWell = UIColorWell()

  override init(frame: CGRect) {
    super.init(frame: frame)
    colorWell.supportsAlpha = false
    colorWell.translatesAutoresizingMaskIntoConstraints = false
    colorWell.addTarget(self, action: #selector(handleColorChange), for: .valueChanged)
    addSubview(colorWell)

    NSLayoutConstraint.activate([
      colorWell.leadingAnchor.constraint(equalTo: leadingAnchor),
      colorWell.trailingAnchor.constraint(equalTo: trailingAnchor),
      colorWell.topAnchor.constraint(equalTo: topAnchor),
      colorWell.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    updateColor()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    nil
  }

  private func updateColor() {
    colorWell.selectedColor = UIColor(hex: colorHex as String) ?? .systemOrange
  }

  @objc
  private func handleColorChange() {
    let hex = colorWell.selectedColor?.hexString ?? "#CA5D2B"
    onColorChange?(["colorHex": hex])
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

  var hexString: String {
    guard let components = cgColor.components else {
      return "#CA5D2B"
    }

    let red = Int((components[0] * 255.0).rounded())
    let green = Int((components.count > 2 ? components[1] : components[0]) * 255.0)
    let blue = Int((components.count > 2 ? components[2] : components[0]) * 255.0)
    return String(format: "#%02X%02X%02X", red, green, blue)
  }
}
