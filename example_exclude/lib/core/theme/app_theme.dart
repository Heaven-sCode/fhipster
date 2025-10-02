import 'package:flutter/material.dart';

import '../env/env.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData get light => _buildTheme(
        Env.get().theme.light,
        Brightness.light,
      );

  static ThemeData get dark => _buildTheme(
        Env.get().theme.dark,
        Brightness.dark,
      );

  static ThemeData _buildTheme(ThemePalette palette, Brightness brightness) {
    final primary = Color(palette.primary);
    final secondary = Color(palette.secondary);
    final accent = Color(palette.accent);

    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      secondary: secondary,
      tertiary: accent,
      brightness: brightness,
    );

    final surface = brightness == Brightness.light
        ? Colors.white
        : const Color(0xFF0F172A);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      primaryColor: primary,
      scaffoldBackgroundColor: surface,
      appBarTheme: AppBarTheme(
        backgroundColor: primary,
        foregroundColor: _onColor(primary),
        elevation: 0,
        centerTitle: false,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: accent,
        foregroundColor: _onColor(accent),
      ),
      chipTheme: ChipThemeData(
        backgroundColor:
            secondary.withOpacity(brightness == Brightness.light ? 0.15 : 0.25),
        labelStyle: TextStyle(color: _onColor(secondary)),
        secondaryLabelStyle: TextStyle(color: _onColor(accent)),
        selectedColor: secondary,
        secondarySelectedColor: accent,
        brightness: brightness,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: StadiumBorder(
          side: BorderSide(color: secondary.withOpacity(0.4)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      cardTheme: CardThemeData(
        color: brightness == Brightness.light
            ? Colors.white
            : const Color(0xFF111827),
        elevation: brightness == Brightness.light ? 2 : 1,
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  static Color _onColor(Color color) {
    return color.computeLuminance() > 0.5 ? Colors.black : Colors.white;
  }
}
