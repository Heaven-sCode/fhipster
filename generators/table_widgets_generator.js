// generators/table_widgets_generator.js
// Emits common reusable table widgets:
//  - FHipsterSearchField: debounced search input
//  - FHipsterPaginationBar: page/size controls with range "x–y of z"
//  - FHipsterTableToolbar: responsive toolbar combining search + action buttons

function generateSearchFieldTemplate() {
  return `import 'dart:async';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

class FHipsterSearchField extends StatefulWidget {
  final String hintText;
  final Duration debounce;
  final ValueChanged<String>? onChangedDebounced;
  final ValueChanged<String>? onChangedImmediate;
  final String? initialText;
  final double? maxWidth;
  final bool enabled;

  const FHipsterSearchField({
    super.key,
    this.hintText = 'Search',
    this.debounce = const Duration(milliseconds: 350),
    this.onChangedDebounced,
    this.onChangedImmediate,
    this.initialText,
    this.maxWidth = 420,
    this.enabled = true,
  });

  @override
  State<FHipsterSearchField> createState() => _FHipsterSearchFieldState();
}

class _FHipsterSearchFieldState extends State<FHipsterSearchField> {
  late final TextEditingController _ctl;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _ctl = TextEditingController(text: widget.initialText ?? '');
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctl.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    widget.onChangedImmediate?.call(v);
    _timer?.cancel();
    _timer = Timer(widget.debounce, () {
      widget.onChangedDebounced?.call(v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final child = TextField(
      controller: _ctl,
      enabled: widget.enabled,
      onChanged: _onChanged,
      decoration: InputDecoration(
        isDense: true,
        prefixIcon: const Icon(Icons.search),
        hintText: widget.hintText.tr,
        border: const OutlineInputBorder(),
      ),
    );

    if (widget.maxWidth == null) return child;
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: widget.maxWidth!),
      child: child,
    );
  }
}
`;
}

function generatePaginationBarTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../core/env/env.dart';

class FHipsterPaginationBar extends StatelessWidget {
  final int page;  // zero-based
  final int size;
  final int total;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<int> onSizeChanged;
  final List<int>? pageSizeOptions;
  final bool busy;

  const FHipsterPaginationBar({
    super.key,
    required this.page,
    required this.size,
    required this.total,
    required this.onPageChanged,
    required this.onSizeChanged,
    this.pageSizeOptions,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    final opts = pageSizeOptions ?? Env.get().pageSizeOptions;
    final start = total == 0 ? 0 : (page * size) + 1;
    final end = ((page + 1) * size).clamp(0, total);

    final canPrev = page > 0 && !busy;
    final canNext = ((page + 1) * size) < total && !busy;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.35),
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          Text('Rows per page:'.tr),
          const SizedBox(width: 8),
          DropdownButton<int>(
            value: size,
            onChanged: busy ? null : (v) { if (v != null) onSizeChanged(v); },
            items: opts.map((e) => DropdownMenuItem(value: e, child: Text(e.toString()))).toList(),
          ),
          const Spacer(),
          Text('\$start–\$end of \$total'),
          IconButton(
            tooltip: 'Previous'.tr,
            icon: const Icon(Icons.chevron_left),
            onPressed: canPrev ? () => onPageChanged(page - 1) : null,
          ),
          IconButton(
            tooltip: 'Next'.tr,
            icon: const Icon(Icons.chevron_right),
            onPressed: canNext ? () => onPageChanged(page + 1) : null,
          ),
        ],
      ),
    );
  }
}
`;
}

function generateTableToolbarTemplate() {
  return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../table/fhipster_search_field.dart';

class FHipsterTableToolbar extends StatelessWidget {
  final VoidCallback? onCreate;
  final VoidCallback? onRefresh;
  final ValueChanged<String>? onSearchDebounced;
  final ValueChanged<String>? onSearchImmediate;
  final String? searchInitial;
  final bool showSearch;
  final bool busy;
  final List<Widget> extraActions;

  const FHipsterTableToolbar({
    super.key,
    this.onCreate,
    this.onRefresh,
    this.onSearchDebounced,
    this.onSearchImmediate,
    this.searchInitial,
    this.showSearch = true,
    this.busy = false,
    this.extraActions = const [],
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (showSearch)
          FHipsterSearchField(
            initialText: searchInitial,
            onChangedImmediate: onSearchImmediate,
            onChangedDebounced: onSearchDebounced,
          ),
        if (onCreate != null)
          FilledButton.icon(
            onPressed: busy ? null : onCreate,
            icon: const Icon(Icons.add),
            label: Text('New'.tr),
          ),
        if (onRefresh != null)
          OutlinedButton.icon(
            onPressed: busy ? null : onRefresh,
            icon: const Icon(Icons.refresh),
            label: Text('Refresh'.tr),
          ),
        ...extraActions,
        if (busy)
          const Padding(
            padding: EdgeInsets.only(left: 8),
            child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
          ),
      ],
    );
  }
}
`;
}

module.exports = {
  generateSearchFieldTemplate,
  generatePaginationBarTemplate,
  generateTableToolbarTemplate,
};
