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

final class DateFieldView: UIView, UIPickerViewDataSource, UIPickerViewDelegate {
  @objc var value: NSString = "" {
    didSet { syncText() }
  }

  @objc var mode: NSString = "date" {
    didSet {
      updatePickerMode()
      syncText()
    }
  }

  @objc var locale: NSString = "en" {
    didSet { updateLocale() }
  }

  @objc var placeholder: NSString = "" {
    didSet { textField.placeholder = placeholder as String }
  }

  @objc var onDateChange: RCTBubblingEventBlock?

  private let calendar = Calendar(identifier: .gregorian)
  private let textField = UITextField()
  private let datePicker = UIDatePicker()
  private let monthPicker = UIPickerView()
  private let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    return formatter
  }()
  private let monthFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    return formatter
  }()
  private let yearValues = Array(1970...2100)
  private var selectedMonthDate = Date()

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupField()
    setupPicker()
    updatePickerMode()
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
    monthPicker.dataSource = self
    monthPicker.delegate = self
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

  private func updatePickerMode() {
    if (mode as String) == "month" {
      formatter.dateFormat = "yyyy-MM"
      textField.inputView = monthPicker
      syncMonthPickerSelection()
    } else {
      datePicker.datePickerMode = .date
      formatter.dateFormat = "yyyy-MM-dd"
      textField.inputView = datePicker
    }

    if textField.isFirstResponder {
      textField.reloadInputViews()
    }
  }

  private func updateLocale() {
    let localeIdentifier = locale as String
    let pickerLocale = Locale(identifier: localeIdentifier)
    datePicker.locale = pickerLocale
    formatter.locale = Locale(identifier: "en_US_POSIX")
    monthFormatter.locale = pickerLocale
    if let toolbar = textField.inputAccessoryView as? UIToolbar,
       let lastItem = toolbar.items?.last {
      lastItem.title = doneTitle(for: localeIdentifier)
    }
    monthPicker.reloadAllComponents()
    syncMonthPickerSelection()
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

    if let date = parseDate(from: raw) {
      if (mode as String) == "month" {
        selectedMonthDate = normalizeMonthDate(date)
        syncMonthPickerSelection()
      } else {
        datePicker.date = date
      }
    } else if (mode as String) == "month" {
      selectedMonthDate = normalizeMonthDate(Date())
      syncMonthPickerSelection()
    }
  }

  private func parseDate(from raw: String) -> Date? {
    if (mode as String) == "month" {
      let monthFormatter = DateFormatter()
      monthFormatter.calendar = Calendar(identifier: .gregorian)
      monthFormatter.locale = Locale(identifier: "en_US_POSIX")
      monthFormatter.dateFormat = "yyyy-MM"
      if let date = monthFormatter.date(from: raw) {
        return date
      }
      let dayFormatter = DateFormatter()
      dayFormatter.calendar = Calendar(identifier: .gregorian)
      dayFormatter.locale = Locale(identifier: "en_US_POSIX")
      dayFormatter.dateFormat = "yyyy-MM-dd"
      return dayFormatter.date(from: raw)
    }

    return formatter.date(from: raw)
  }

  private func normalizeMonthDate(_ date: Date) -> Date {
    let components = calendar.dateComponents([.year, .month], from: date)
    return calendar.date(from: DateComponents(
      calendar: calendar,
      year: components.year,
      month: components.month,
      day: 1
    )) ?? date
  }

  private func syncMonthPickerSelection() {
    let components = calendar.dateComponents([.year, .month], from: selectedMonthDate)
    guard
      let year = components.year,
      let month = components.month,
      let yearRow = yearValues.firstIndex(of: year)
    else {
      return
    }

    monthPicker.selectRow(yearRow, inComponent: 0, animated: false)
    monthPicker.selectRow(max(month - 1, 0), inComponent: 1, animated: false)
  }

  private func emitValue(_ nextValue: String) {
    textField.text = nextValue
    onDateChange?(["value": nextValue])
  }

  @objc
  private func handlePickerChange() {
    if (mode as String) == "month" {
      emitValue(formatter.string(from: selectedMonthDate))
    } else {
      emitValue(formatter.string(from: datePicker.date))
    }
  }

  @objc
  private func doneTapped() {
    if (textField.text ?? "").isEmpty {
      handlePickerChange()
    }
    textField.resignFirstResponder()
  }

  func numberOfComponents(in pickerView: UIPickerView) -> Int {
    2
  }

  func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int {
    component == 0 ? yearValues.count : 12
  }

  func pickerView(_ pickerView: UIPickerView, widthForComponent component: Int) -> CGFloat {
    component == 0 ? 110 : 150
  }

  func pickerView(_ pickerView: UIPickerView, titleForRow row: Int, forComponent component: Int) -> String? {
    if component == 0 {
      return String(yearValues[row])
    }

    let monthSymbols = monthFormatter.standaloneMonthSymbols ?? monthFormatter.monthSymbols ?? []
    guard row >= 0, row < monthSymbols.count else {
      return String(format: "%02d", row + 1)
    }
    return monthSymbols[row]
  }

  func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent component: Int) {
    let yearRow = pickerView.selectedRow(inComponent: 0)
    let monthRow = pickerView.selectedRow(inComponent: 1)
    guard yearRow >= 0, yearRow < yearValues.count else {
      return
    }

    let year = yearValues[yearRow]
    let month = monthRow + 1
    selectedMonthDate = calendar.date(from: DateComponents(
      calendar: calendar,
      year: year,
      month: month,
      day: 1
    )) ?? selectedMonthDate

    emitValue(formatter.string(from: selectedMonthDate))
  }
}
