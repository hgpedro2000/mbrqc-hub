# Memory: index.md
Updated: now

# Quality Hub Project

## Architecture
- Hub page at `/` with 5 modules: Tryout, Auditorias, Contenção, Apontamentos, Alerta de Qualidade
- Tryout module routes under `/tryout/*`
- Language: Portuguese (BR) default, English toggle available
- i18n: react-i18next with pt.json/en.json in src/i18n/locales/

## Design
- Fonts: Space Grotesk (heading), DM Sans / Inter (body)
- Dark industrial theme on Dashboard
- Uses semantic tokens from index.css

## i18n Status
- Infrastructure: DONE (i18n config, LanguageToggle component)
- Translated pages: Hub, Login, ChangePassword, ForgotPassword, NotFound
- Remaining pages need `useTranslation()` + `t()` keys: Index, Dashboard, Engenharia, InjectionForm, EditableChecklist, Auditorias, AuditoriaForm, AuditoriaDashboard, Contencao, ContencaoForm, ContencaoDashboard, Apontamentos, ApontamentoForm, ApontamentoDashboard, AlertaQualidade, AlertaQualidadeForm, AlertaQualidadeDashboard, TryoutRegistros, MasterListFilter, SupplierPartSelector, EngineeringMode
- All translation keys already exist in pt.json and en.json
