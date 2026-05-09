import {useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors} from '@/theme/colors';

export type SelectOption = {
  label: string;
  value: string;
  color?: string;
};

type SelectFieldProps = {
  options: SelectOption[];
  value: string;
  placeholder: string;
  onSelect: (value: string) => void;
};

export function SelectField({
  onSelect,
  options,
  placeholder,
  value,
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value) ?? null;

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)} style={styles.trigger}>
        <View style={styles.triggerContent}>
          {selectedOption?.color ? (
            <View
              style={[
                styles.colorDot,
                {backgroundColor: selectedOption.color},
              ]}
            />
          ) : null}
          <Text
            style={[
              styles.triggerText,
              selectedOption ? undefined : styles.placeholderText,
            ]}>
            {selectedOption?.label ?? placeholder}
          </Text>
        </View>
        <Text style={styles.chevron}>v</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}>
        <Pressable onPress={() => setIsOpen(false)} style={styles.overlay}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{placeholder}</Text>
            <ScrollView
              contentContainerStyle={styles.optionList}
              keyboardShouldPersistTaps="handled">
              {options.map(option => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onSelect(option.value);
                      setIsOpen(false);
                    }}
                    style={[
                      styles.option,
                      active ? styles.optionActive : undefined,
                    ]}>
                    <View style={styles.optionContent}>
                      {option.color ? (
                        <View
                          style={[
                            styles.colorDot,
                            {backgroundColor: option.color},
                          ]}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.optionText,
                          active ? styles.optionTextActive : undefined,
                        ]}>
                        {option.label}
                      </Text>
                    </View>
                    {active ? <Text style={styles.checkmark}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  triggerText: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
  },
  placeholderText: {
    color: '#938171',
  },
  chevron: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 27, 23, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '75%',
    padding: 18,
    width: '100%',
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  optionList: {
    gap: 10,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionActive: {
    backgroundColor: colors.accentSoftMuted,
    borderColor: colors.accentSoft,
  },
  optionContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  optionText: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextActive: {
    color: colors.accentDeep,
  },
  colorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  checkmark: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 12,
  },
});
