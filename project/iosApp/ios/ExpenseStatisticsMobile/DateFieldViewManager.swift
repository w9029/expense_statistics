import UIKit
import React

@objc(DateFieldViewManager)
class DateFieldViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    DateFieldView()
  }
}

final class DateFieldView: UIView {
  @objc var value: NSString = "" {
    didSet { syncText() }
  }

  @objc var locale: NSString = "en" {
    didSet { updateLocale() }
  }

  @objc var placeholder: NSString = "" {
    didSet { textField.placeholder = placeholder as String }
  }

  @objc var onDateChange: RCTBubblingEventBlock?

  private let textField = UITextField()
  private let datePicker = UIDatePicker()
  private let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter
  }()

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupField()
    setupPicker()
    updateLocale()
    syncText()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    nil
  }

  private func setupField() {
    backgroundColor = UIColor(red: 0.97, green: 0.94, blue: 0.89, alpha: 1)
    layer.cornerRadius = 16
    layer.borderWidth = 1
    layer.borderColor = UIColor(red: 0.87, green: 0.80, blue: 0.73, alpha: 1).cgColor

    textField.translatesAutoresizingMaskIntoConstraints = false
    textField.textColor = UIColor(red: 0.12, green: 0.11, blue: 0.09, alpha: 1)
    textField.font = UIFont.systemFont(ofSize: 16)
    textField.tintColor = .clear
    addSubview(textField)

    NSLayoutConstraint.activate([
      textField.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
      textField.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
      textField.topAnchor.constraint(equalTo: topAnchor, constant: 14),
      textField.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14),
    ])
  }

  private func setupPicker() {
    datePicker.datePickerMode = .date
    datePicker.preferredDatePickerStyle = .wheels
    datePicker.addTarget(self, action: #selector(handlePickerChange), for: .valueChanged)
    textField.inputView = datePicker

    let toolbar = UIToolbar()
    toolbar.sizeToFit()
    toolbar.items = [
      UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil),
      UIBarButtonItem(title: doneTitle(for: locale as String), style: .done, target: self, action: #selector(doneTapped)),
    ]
    textField.inputAccessoryView = toolbar
  }

  private func updateLocale() {
    let localeIdentifier = locale as String
    let pickerLocale = Locale(identifier: localeIdentifier)
    datePicker.locale = pickerLocale
    formatter.locale = Locale(identifier: "en_US_POSIX")
    if let toolbar = textField.inputAccessoryView as? UIToolbar,
       let lastItem = toolbar.items?.last {
      lastItem.title = doneTitle(for: localeIdentifier)
    }
  }

  private func doneTitle(for localeIdentifier: String) -> String {
    if localeIdentifier.hasPrefix("zh") {
      return "完成"
    }
    if localeIdentifier.hasPrefix("ja") {
      return "完了"
    }
    return "Done"
  }

  private func syncText() {
    let raw = value as String
    textField.placeholder = placeholder as String
    textField.text = raw.isEmpty ? nil : raw

    if let date = formatter.date(from: raw) {
      datePicker.date = date
    }
  }

  @objc
  private func handlePickerChange() {
    let nextValue = formatter.string(from: datePicker.date)
    textField.text = nextValue
    onDateChange?(["value": nextValue])
  }

  @objc
  private func doneTapped() {
    if (textField.text ?? "").isEmpty {
      handlePickerChange()
    }
    textField.resignFirstResponder()
  }
}
