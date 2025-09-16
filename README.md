# FHipster

![FHipster - Flutter tool for converting JDL to Flutter ](https://theheavenscode.com/assets/images/Technologies/fhipster.png)

## 🚀 JDL → Flutter (GetX) Generator

**FHipster** turns your JHipster Domain Language (JDL) into a production-ready **Flutter `lib/`** with all the bells & whistles:

- ✅ GetX-first architecture (stateless views, controller-owned state)
- ✅ **Dual auth**: Keycloak (OIDC) *or* JHipster JWT
- ✅ **Profiles** baked into `env.dart` (`dev` & `prod`) + `Env.setProfile('...')`
- ✅ Optional `main.dart` emission from config (`emitMain: true`)
- ✅ Clean **App Shell** for web & mobile (NavigationRail/Drawer)
- ✅ Models, Services, Controllers, Forms, Table views
- ✅ **JPA criteria filtering** + **Elasticsearch search**
- ✅ Relationship-aware models & forms (O2O / M2O / O2M / M2M)
- ✅ Responsive forms with `responsive_grid`
- ✅ Route guards (auth + role-based)
- ✅ Reusable widgets (inputs, table toolbar, pagination)
- ✅ *(optional)* Offline cache with SQLite + background sync + connectivity tracking
- ✅ **Non-destructive writes**: unchanged files are **skipped**; use `--force` to overwrite

---

## ✨ What gets generated

- **Core**
  - `core/env/env.dart` — profiles (`dev` & `prod`) and all runtime config
  - `core/api_client.dart` — GetConnect; injects `Authorization`, 401 auto-refresh
  - `core/auth/*` — `AuthService`, `AuthMiddleware`, `RoleMiddleware`, `token_decoder.dart`
  - `core/app_shell.dart` — responsive shell (web & mobile)
  - `core/theme/app_theme.dart` — Material 3 light/dark theme driven by config palettes
  - `core/routes.dart` — GetX routes (Splash, Login, Home, 401, 403, + per-entity)
  - *(optional)* `main.dart` — if `emitMain: true` in your config

- **Per entity** (from your JDL)
  - `models/<entity>_model.dart` — primitives + relationship fields
  - `services/<entity>_service.dart` — `GET/LIST/POST/PUT/PATCH/DELETE`, criteria, search
  - `controllers/<entity>_controller.dart` — list+form state, CRUD, relation loaders
  - `forms/<entity>_form.dart` — stateless `GetView`, responsive fields & validation
  - `views/<entity>_table_view.dart` — search, pagination, horizontal table, view/edit/delete dialogs

- **Enums**
  - `enums/<enum>_enum.dart` — Dart enum + (de)serializers

- **Common widgets**
  - `widgets/fhipster_input_field.dart`
  - `widgets/table/` search field, pagination bar, toolbar
  - `widgets/common/confirm_dialog.dart`
  - *(opt-in)* `core/connectivity/` & `core/sync/` services when offline mode is enabled

> Relationships follow JHipster semantics:
> - O2O/M2O → single `TargetModel?`
> - O2M/M2M → `List<TargetModel>?`
> - Forms render dropdowns (single) or chip multi-select (multi)

---

## 🧰 Install

```bash
npm install -g fhipster
```

> Requires Node 16+.

---

## 🔧 CLI Usage

```bash
fhipster <jdl-file> --microservice <name> [options]
```

**Core flags**

- `-m, --microservice` **(required)**: service name (e.g. `dms`)
- `-o, --outputDir` *(default: `flutter_generated`)* — use `./lib` to generate straight into your app
- `-a, --apiHost` *(default: `http://localhost:8080`)*
- `--useGateway` — use JHipster API Gateway paths (`/services/<svc>/api/**`)
- `--gatewayServiceName <name>` — service id for gateway paths
- `--force, -f` — **overwrite all** generated files even if unchanged  
  *(by default, FHipster compares content and **skips** writing if identical)*

**Auth flags (dual auth)**

- `-p, --authProvider` : `keycloak` **(default)** | `jhipsterJwt`
- `--jwtAuthEndpoint` : JWT login endpoint (default: `/api/authenticate`)
- `--accountEndpoint` : JWT account/identity endpoint (default: `/api/account`)

**Profiles & main**

- YAML `profiles.dev` & `profiles.prod` → baked into `env.dart`
- `--emitMain` or `emitMain: true` in YAML → generates `lib/main.dart`
- `enableSQLite: true` → opt-in to local cache, background sync and generated `SyncService`
- `tenantIsolationEnabled: true` + `tenantFieldName: userId` → auto-filter every REST call by user/tenant field
- `syncIntervalMinutes: 15` → schedule periodic background sync (default 15 minutes)
- `theme.light|dark.primary|secondary|accent` → define hex colors for the generated `AppTheme`

**Examples**

```bash
# With YAML (recommended)
fhipster --config ./fhipster.config.yaml

# CLI only
fhipster ./JDL/app.jdl   --microservice operationsModule   --apiHost http://234.50.81.155:8080   --useGateway --gatewayServiceName operationsModule   --outputDir ./lib   --emitMain

# JWT backend
fhipster ./app.jdl -m store -a https://api.example.com   --authProvider jhipsterJwt   --jwtAuthEndpoint /api/authenticate   --accountEndpoint /api/account   ./lib
```

---

## 📁 Output structure (overview)

```
lib/
  core/
    app_shell.dart
    api_client.dart
    routes.dart
    theme/
      app_theme.dart
    env/
      env.dart
    auth/
      auth_service.dart
      auth_middleware.dart
      role_middleware.dart
      token_decoder.dart
  controllers/
    <entity>_controller.dart
  services/
    <entity>_service.dart
  models/
    <entity>_model.dart
  enums/
    <enum>_enum.dart
  forms/
    <entity>_form.dart
  views/
    splash_view.dart
    login_view.dart
    home_view.dart
    unauthorized_view.dart
    forbidden_view.dart
    <entity>_table_view.dart
  widgets/
    fhipster_input_field.dart
    common/
      confirm_dialog.dart
    table/
      fhipster_search_field.dart
      fhipster_pagination_bar.dart
      fhipster_table_toolbar.dart

# (optional when emitMain: true)
main.dart
```

---

## 📦 Offline cache & background sync *(optional)*

- Set `enableSQLite: true` in `fhipster.config.yaml` to generate:
  - `core/local/local_database.dart` + per-entity DAOs (`core/local/dao/*`)
  - `core/connectivity/connectivity_service.dart` to track offline/online windows
  - `core/sync/sync_service.dart` to push local changes, refresh remote data, and expose `isSyncing`
- Generated controllers/views call `SyncService.syncNow()` (guarded with `catchError`) and table views show an overlay loader while syncing.
- A sample manifest, `pubspec.offline_sample.yaml`, is emitted in the project root listing the required packages (`get_storage`, `connectivity_plus`, `sqflite`, `path`, `path_provider`, …). Merge those into your real `pubspec.yaml` before running `flutter pub get`.
- Use `syncIntervalMinutes` (global or per profile) to control how often the background sync timer runs.
- When `tenantIsolationEnabled` is true, all generated REST calls (including search) automatically include the tenant filter; the SQLite cache stores `server_updated_at` & `local_updated_at` so you can extend the merge logic easily.

> **Heads up:** the scaffolded sync logic mirrors the server state and clears `dirty` flags when remote updates succeed. Conflict resolution policies are left to you—extend `SyncService` if you need finer control.

---

## 🔐 Storage & Security

### Token storage (default)
- Uses **`get_storage`** for access/refresh tokens and expiry timestamps.
- Keys are configurable in `env.dart` (`storageKeyAccessToken`, etc).

### Optional: secure storage
If your security model requires OS‑level encryption at rest, switch to **`flutter_secure_storage`** inside `AuthService` (drop-in replacement for the read/write methods).

Add the package:
```bash
flutter pub add flutter_secure_storage
```

Then modify `AuthService` where indicated by comments to use `FlutterSecureStorage` instead of `GetStorage`.  
> This change is local to `AuthService` and does not affect the rest of the generated code.

### HTTPS & certificate pinning (optional)
If you need certificate pinning or stricter TLS, extend `ApiClient` (GetConnect) to configure a custom `HttpClient` and `SecurityContext`. Hooks are already in place to centralize headers & retries.

---

## ⚙️ Flutter wiring

Add dependencies:

```bash
flutter pub add get get_storage responsive_grid
# Optional (if you switch AuthService to secure storage)
# flutter pub add flutter_secure_storage
```

Minimal `main.dart` (if you didn’t use `emitMain`):

```dart
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'core/env/env.dart';
import 'core/api_client.dart';
import 'core/auth/auth_service.dart';
import 'core/routes.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GetStorage.init();

  // Use generator-baked profiles
  Env.initGenerated();
  // (Optional) Switch at runtime:
  // Env.setProfile('prod'); // or pass --dart-define=ENV=prod at launch

  if (!Get.isRegistered<ApiClient>()) Get.put(ApiClient(), permanent: true);
  if (!Get.isRegistered<AuthService>()) Get.put(AuthService(), permanent: true);

  runApp(GetMaterialApp(
    initialRoute: AppRoutes.splash,
    getPages: AppRoutes.pages,
    defaultTransition: Transition.fadeIn,
  ));
}
```

> Services read base paths & headers from `Env.get()`.

---

## 🔎 Filtering & Search (service support)

- **Criteria (JPA meta filtering)** via query params:
```dart
final result = await orderService.listPaged(
  page: 0,
  size: 20,
  sort: ['id,desc'],
  filters: {
    'status': {'in': ['PAID','NEW']},
    'total': {'greaterThan': 100},
    'createdDate': {'specified': true},
  },
  distinct: true,
);
```

- **Elasticsearch search** (if backend exposes `/_search/<entities>`):
```dart
final search = await orderService.search(
  query: 'customer:john*',
  page: 0,
  size: 20,
);
```

- **PATCH** uses `application/merge-patch+json`:
```dart
await orderService.patch(id, {'status': 'PAID'});
```

---

## 🧪 Example JDL

```jdl
entity BlogPost {
  title String required,
  content TextBlob,
  published Instant
}

entity Comment {
  text String required,
  created Instant
}

relationship OneToMany {
  BlogPost to Comment{post}
}
```

Generate:

```bash
fhipster ./blog.jdl -m blog -a http://localhost:8080 ./lib
```

This creates models, services, controllers, forms and a table view for **BlogPost** and **Comment**, wired into routes and the app shell.

---

## 🧰 Local development

```bash
git clone <your-repo>
cd fhipster
npm install
npm link           # makes "fhipster" available globally
fhipster --help
```

---

## 🐛 Troubleshooting

- **“JDL file not found”** — check `jdlFile` in YAML or pass it as the first positional arg.
- **“main.dart not generated”** — set `emitMain: true` in YAML or pass `--emitMain`.
- **Generated into wrong folder** — set `outputDir: ./lib` if you want to write directly into a Flutter app.
- **Auth errors** — verify Keycloak endpoints and client, or JWT endpoints; confirm CORS and gateway paths.
- **Nothing changed** — files are hashed; unchanged files show as “Skipped — unchanged”. Use `--force` to rewrite.

---

## 🤝 Contributing

PRs welcome!

1. Fork → branch → commit → PR  
2. Keep changes focused  
3. Follow existing code style

---

## 📜 License

MIT — see `LICENSE`.

---

## 🙏 Acknowledgements

Inspired by the JHipster community. Built with ❤️ by Heaven'sCode.

---

## 🛣️ Roadmap

- More field types & validations
- Extra table widgets (column chooser, server side sorting)
- Template customization hooks
- Interactive CLI wizard
- Example backend + end-to-end sample
