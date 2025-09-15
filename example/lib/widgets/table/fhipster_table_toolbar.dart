import 'package:flutter/material.dart';

/// A simple toolbar row that can host a search field on the left and
/// arbitrary trailing actions on the right.
class FHipsterTableToolbar extends StatelessWidget {
  final Widget? leading;       // e.g., FHipsterSearchField
  final List<Widget> actions;  // e.g., [IconButton(...), ...]
  final EdgeInsetsGeometry padding;

  const FHipsterTableToolbar({
    super.key,
    this.leading,
    this.actions = const [],
    this.padding = const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        children: [
          if (leading != null) leading!,
          const Spacer(),
          ...actions.map((w) => Padding(
                padding: const EdgeInsets.only(left: 8),
                child: w,
              )),
        ],
      ),
    );
  }
}
