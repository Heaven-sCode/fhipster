import 'package:flutter/material.dart';

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
