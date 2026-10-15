import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type Props = {
  editing: boolean;
  value: string;
  onChange: (next: string) => void;
  style?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
  multiline?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
};

/** Text that becomes a TextInput when pitch edit mode is on. */
export function PitchEditableField({
  editing,
  value,
  onChange,
  style,
  inputStyle,
  multiline = true,
  placeholder,
  accessibilityLabel,
}: Props) {
  if (!editing) {
    return <Text style={style}>{value}</Text>;
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      accessibilityLabel={accessibilityLabel ?? placeholder}
      style={[styles.input, style, inputStyle]}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
});
