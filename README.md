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
