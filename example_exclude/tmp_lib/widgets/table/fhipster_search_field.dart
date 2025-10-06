import 'package:flutter/material.dart';

class FHipsterSearchField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onClear;
  final bool autofocus;

  const FHipsterSearchField({
    super.key,
    required this.controller,
    this.hintText = 'Search',
    this.onChanged,
    this.onClear,
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: TextField(
        controller: controller,
        autofocus: autofocus,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          prefixIcon: const Icon(Icons.search),
          hintText: hintText,
          suffixIcon: controller.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Clear',
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    controller.clear();
                    onClear?.call();
                    onChanged?.call('');
                  },
                ),
        ),
      ),
    );
  }
}
