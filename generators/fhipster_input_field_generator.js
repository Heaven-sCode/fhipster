// generators/fhipster_input_field_generator.js
// Emits lib/widgets/fhipster_input_field.dart
// - Reusable input with label/hint, prefix/suffix, password toggle
// - Adapts to theme InputDecoration defaults
// - Highlights label on focus or when filled

function generateFHipsterInputFieldTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class FHipsterInputField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final Widget? prefix;
  final Widget? suffix;
  final TextInputType keyboardType;
  final bool readOnly;
  final VoidCallback? onTap;
  final String? Function(String?)? validator;
  final List<TextInputFormatter>? inputFormatters;
  final bool isPassword;

  const FHipsterInputField({
    super.key,
    required this.controller,
    this.label = '',
    this.hint = '',
    this.prefix,
    this.suffix,
    this.keyboardType = TextInputType.text,
    this.readOnly = false,
    this.onTap,
    this.validator,
    this.inputFormatters,
    this.isPassword = false,
  });

  @override
  State<FHipsterInputField> createState() => _FHipsterInputFieldState();
}

class _FHipsterInputFieldState extends State<FHipsterInputField> {
  final FocusNode _focusNode = FocusNode();
  bool _hasFocus = false;
  bool _obscureText = true;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.isPassword;
    _focusNode.addListener(_onFocusChange);
    widget.controller.addListener(_onTextChange);
  }

  void _onFocusChange() {
    setState(() {
      _hasFocus = _focusNode.hasFocus;
    });
  }

  void _onTextChange() {
    setState(() {});
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    widget.controller.removeListener(_onTextChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final borderColor = theme.inputDecorationTheme.enabledBorder?.borderSide.color ?? Colors.grey;
    final focusedBorderColor = theme.inputDecorationTheme.focusedBorder?.borderSide.color ?? theme.colorScheme.primary;
    final labelColor = theme.inputDecorationTheme.labelStyle?.color ?? theme.colorScheme.onSurface;
    final isHighlighted = _hasFocus || widget.controller.text.isNotEmpty;

    return TextFormField(
      controller: widget.controller,
      focusNode: _focusNode,
      keyboardType: widget.keyboardType,
      obscureText: widget.isPassword ? _obscureText : false,
      readOnly: widget.readOnly,
      onTap: widget.onTap,
      validator: widget.validator,
      inputFormatters: widget.inputFormatters,
      decoration: InputDecoration(
        labelText: widget.label,
        labelStyle: TextStyle(
          color: isHighlighted ? focusedBorderColor : labelColor,
          fontWeight: isHighlighted ? FontWeight.w900 : FontWeight.w700,
          fontSize: isHighlighted ? 18 : 12,
        ),
        hintText: widget.hint,
        hintStyle: theme.inputDecorationTheme.hintStyle,
        prefixIcon: widget.prefix != null
            ? Padding(
                padding: const EdgeInsets.only(left: 20, right: 4),
                child: widget.prefix,
              )
            : null,
        suffixIcon: widget.isPassword
            ? IconButton(
                icon: Icon(_obscureText ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => _obscureText = !_obscureText),
              )
            : widget.suffix != null
                ? Padding(
                    padding: const EdgeInsets.only(right: 20, left: 4),
                    child: widget.suffix,
                  )
                : null,
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        filled: true,
        fillColor: theme.inputDecorationTheme.fillColor,
        contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
        border: theme.inputDecorationTheme.border,
        enabledBorder: theme.inputDecorationTheme.enabledBorder ??
            OutlineInputBorder(borderSide: BorderSide(color: borderColor)),
        focusedBorder: theme.inputDecorationTheme.focusedBorder ??
            OutlineInputBorder(borderSide: BorderSide(color: focusedBorderColor)),
      ),
    );
  }
}
`;
}

module.exports = { generateFHipsterInputFieldTemplate };
