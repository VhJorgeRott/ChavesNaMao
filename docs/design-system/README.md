# Design System — Rottas Control

Documentação do design system do app: tokens, componentes, padrões visuais e regras inegociáveis. É a referência para criar **qualquer** tela, modal, card, tabela ou elemento visual.

## Por onde começar

👉 **[INDEX.md](INDEX.md)** é o ponto de entrada. Ele tem a tabela "abra quando..." + as **regras inegociáveis**.

> **Regra de ouro:** consulte **apenas o arquivo temático relevante** — não abra todos. Ex: vai mexer num modal? Leia só [modais.md](modais.md).

## Arquivos

| Tema | Arquivo |
|---|---|
| Marca / logo | [marca.md](marca.md) |
| Cores, CSS vars, dark mode | [tokens.md](tokens.md) |
| Fontes, pesos, headings | [tipografia.md](tipografia.md) |
| Botões, CTA, icon-button | [botoes.md](botoes.md) |
| Inputs, selects, switches | [formularios.md](formularios.md) |
| Modais, dialogs, drawers | [modais.md](modais.md) |
| Sidebar, header, tabs | [navegacao.md](navegacao.md) |
| Page wrapper, grids, cards | [cards-layout.md](cards-layout.md) |
| Fundo de página (`--page-bg`) | [page-background.md](page-background.md) |
| Badges, pills de status, delta | [badges-status.md](badges-status.md) |
| Tabelas (virtualizada, HTML) | [tabelas.md](tabelas.md) |
| Gráficos recharts | [graficos.md](graficos.md) |
| Tooltips | [tooltips.md](tooltips.md) |
| Ícones (lucide, Lottie, SVG) | [icones.md](icones.md) |
| Toast, skeleton, loaders, alerts | [feedback.md](feedback.md) |

Pasta [brand/](brand/) → cópias dos logos só para preview da doc (ver [brand/README.md](brand/README.md)).

## Manutenção

**Sempre que alterar um padrão visual, atualize o arquivo temático correspondente.** Se afetar uma regra inegociável, ajuste também o [INDEX.md](INDEX.md). Antes de criar componente novo, confira [src/components/ui/](../../src/components/ui/) (shadcn) e [src/components/shared/](../../src/components/shared/).
