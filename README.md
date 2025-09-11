# FHipster

![FHipster - Flutter tool for converting JDL to Flutter ](https://dl3.pushbulletusercontent.com/T5UCg8KcfSBk06wyziPK2ZKTMzUByfZg/a-digital-illustration-of-a-smiling-hipp_u60V8NX0TUa5-x-HyyWx3A_o3ipjE9jTLSC1SopRHOWWw.jpeg)

## 🚀 JDL → Flutter (GetX) Generator

**FHipster** turns your JHipster Domain Language (JDL) into a production-ready **Flutter `lib/`** with:

- ✅ GetX-first architecture (stateless views, controller-owned state)
- ✅ Keycloak auth (token + refresh) via a central `ApiClient` and `AuthService`
- ✅ Clean App Shell for web & mobile (NavigationRail/Drawer)
- ✅ Models, Services, Controllers, Forms, Table views
- ✅ JPA criteria filtering + Elasticsearch search
- ✅ Relationship-aware models & forms (O2O / M2O / O2M / M2M)
- ✅ Responsive forms with `responsive_grid`
- ✅ Route guards (auth + role-based)
- ✅ Reusable widgets (inputs, table toolbar, pagination)

---

## ✨ What gets generated

- **Core**
  - `core/env/env.dart` — self-contained environment with `Env.init(...)`
  - `core/api_client.dart` — GetConnect + Keycloak token/refresh, headers, retries
  - `core/auth/*` — `AuthService`, `AuthMiddleware`, `RoleMiddleware`, `token_decoder.dart`
  - `core/app_shell.dart` — responsive shell (web & mobile)
  - `core/routes.dart` — GetX routes (Splash, Login, Home, 401, 403, + per-entity)

- **Per entity** (from your JDL)
  - `models/<entity>_model.dart` — primitives + relationship fields
  - `services/<entity>_service.dart` — `GET/LIST/POST/PUT/PATCH/DELETE`, criteria, search
  - `controllers/<entity>_controller.dart` — list+form state, CRUD, relation loaders
  - `forms/<entity>_form.dart` — stateless GetView, responsive fields & validation
  - `views/<entity>_table_view.dart` — search, pagination, horizontal table, view/edit/delete dialogs

- **Enums**
  - `enums/<enum>_enum.dart` — Dart enum + (de)serializers

- **Common widgets**
  - `widgets/fhipster_input_field.dart`
  - `widgets/table/` search field, pagination bar, toolbar
  - `widgets/common/confirm_dialog.dart` (simple Yes/No)

> Relationships follow JHipster semantics:
> - O2O/M2O → single `TargetModel?`
> - O2M/M2M → `List<TargetModel>?`
> - Form inputs render dropdowns (single) or chip multi-select (multi)

---

## 🧰 Install

```bash
npm install -g fhipster
```

> Requires Node 16+.

---

## 🔧 CLI Usage

```bash
fhipster <jdl-file> --microservice <name> [--apiHost <host>] [outputDir]
```

**Flags**

- `-m, --microservice` **(required)**: service name (e.g. `dms`)
- `-a, --apiHost` *(optional)*: base API host (default: `https://api.yourapp.com`)
- `outputDir` *(optional positional)*: output folder (default: `flutter_generated`).  
  Use `./lib` to generate directly into your app.

**Examples**

```bash
# Generate into a new folder
fhipster ./application.jdl -m blog -a http://localhost:8080

# Generate directly into your Flutter app's lib/
cd my_flutter_app
fhipster ../specs/app.jdl -m dms -a https://api.example.com ./lib
```

Run `fhipster --help` for details.

---

## 📁 Output structure (overview)

```
lib/
  core/
    app_shell.dart
    api_client.dart
    routes.dart
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

## ⚙️ Flutter wiring (once per app)

Add dependencies:

```bash
flutter pub add get get_storage responsive_grid
```

Minimal `main.dart`:

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

  Env.init(EnvConfig(
    appName: 'My App',
    envName: 'dev',
    apiHost: 'http://localhost:8080',
    tokenEndpoint: 'http://localhost:8080/realms/myrealm/protocol/openid-connect/token',
    logoutEndpoint: 'http://localhost:8080/realms/myrealm/protocol/openid-connect/logout',
    authorizeEndpoint: 'http://localhost:8080/realms/myrealm/protocol/openid-connect/auth',
    userinfoEndpoint: 'http://localhost:8080/realms/myrealm/protocol/openid-connect/userinfo',
    keycloakClientId: 'my-client',
    keycloakClientSecret: '',
    keycloakScopes: ['openid', 'profile', 'email', 'offline_access'],
  ));

  Get.put(ApiClient(), permanent: true);
  Get.put(AuthService(), permanent: true);

  runApp(GetMaterialApp(
    initialRoute: AppRoutes.splash,
    getPages: AppRoutes.pages,
    defaultTransition: Transition.fadeIn,
  ));
}
```

> The environment file is independent and self-sufficient — initialize it via `Env.init(...)`.  
> Services read base paths and headers from `Env.get()`.

---

## 🔎 Filtering & Search (what the services support)

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

## 🔐 Auth flow

- **Keycloak** Password Grant (`offline_access` supported)
- Automatic **token refresh** on 401 / before requests
- **Auth guard** and **role guard** middlewares
- `AuthService` exposes `username`, `displayName`, `authorities`, and token expiries

> Ensure your Keycloak client enables **Direct Access Grants** if you use the password flow.

---

## 🤝 Contributing

PRs welcome!

1. Fork → branch → commit → PR  
2. Keep changes focused and covered  
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
- Extra table widgets (column chooser, server sort)
- Template customization hooks
- Interactive CLI wizard
- Example backend + end-to-end sample