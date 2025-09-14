// generators/table_widgets_generator.js
// Returns a map of relative widget file paths -> Dart source.
// bin/index.js will iterate this map and write each file under lib/widgets/<relPath>

function generateTableWidgetsTemplates() {
  return {
    // ---- Table widgets ------------------------------------------------------
    'table/fhipster_search_field.dart': dartSearchField(),
    'table/fhipster_pagination_bar.dart': dartPaginationBar(),
    'table/fhipster_table_toolbar.dart': dartTableToolbar(),

    // ---- Common widgets -----------------------------------------------------
    'common/confirm_dialog.dart': dartConfirmDialog(),
  };
}

function dartSearchField() {
  return `import 'package:flutter/material.dart';

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
`;
}

function dartPaginationBar() {
  return `import 'package:flutter/material.dart';

class FHipsterPaginationBar extends StatelessWidget {
  final int page; // 0-based
  final int size;
  final int total;
  final List<int> pageSizeOptions;
  final ValueChanged<int>? onPageChanged; // new page index (0-based)
  final ValueChanged<int>? onSizeChanged; // new page size

  const FHipsterPaginationBar({
    super.key,
    required this.page,
    required this.size,
    required this.total,
    this.pageSizeOptions = const [10, 20, 50, 100],
    this.onPageChanged,
    this.onSizeChanged,
  });

  @override
  Widget build(BuildContext context) {
    final int first = total == 0 ? 0 : (page * size) + 1;
    final int last = total == 0 ? 0 : ((page + 1) * size).clamp(0, total);
    final int pageCount = (total == 0 || size <= 0) ? 1 : ((total + size - 1) ~/ size);
    final bool canPrev = page > 0;
    final bool canNext = (page + 1) < pageCount;

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text('$first–$last of $total'),
        const SizedBox(width: 12),
        IconButton(
          tooltip: 'Previous',
          icon: const Icon(Icons.chevron_left),
          onPressed: canPrev ? () => onPageChanged?.call(page - 1) : null,
        ),
        IconButton(
          tooltip: 'Next',
          icon: const Icon(Icons.chevron_right),
          onPressed: canNext ? () => onPageChanged?.call(page + 1) : null,
        ),
        const SizedBox(width: 16),
        DropdownButton<int>(
          value: size,
          underline: const SizedBox.shrink(),
          items: pageSizeOptions.map((v) => DropdownMenuItem<int>(
            value: v,
            child: Text('$v / page'),
          )).toList(),
          onChanged: (v) {
            if (v != null) onSizeChanged?.call(v);
          },
        ),
      ],
    );
  }
}
`;
}

function dartTableToolbar() {
  return `import 'package:flutter/material.dart';

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
`;
}

function dartConfirmDialog() {
  return `import 'package:flutter/material.dart';

Future<bool?> showConfirmDialog(
  BuildContext context, {
  String title = 'Confirm',
  String message = 'Are you sure?',
  String confirmText = 'Yes',
  String cancelText = 'No',
  bool destructive = false,
}) {
  final theme = Theme.of(context);
  return showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: Text(cancelText),
        ),
        FilledButton(
          style: destructive
              ? FilledButton.styleFrom(
                  backgroundColor: theme.colorScheme.error,
                  foregroundColor: theme.colorScheme.onError,
                )
              : null,
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmText),
        ),
      ],
    ),
  );
}
`;
}

module.exports = { generateTableWidgetsTemplates };
