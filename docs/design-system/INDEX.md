# Design System — Índice

Consulte **apenas o arquivo relevante** desta pasta. Não abra todos.

| Arquivo | Abra quando... |
|---|---|
| [marca.md](marca.md) | Usar/posicionar o logo da Rottas (símbolo, lockup), tamanhos, cor de marca, área de respiro |
| [tokens.md](tokens.md) | Mexer com cores, CSS vars, radius, spacing, dark mode |
| [tipografia.md](tipografia.md) | Escolher peso/tamanho de fonte, section titles, headings |
| [botoes.md](botoes.md) | Adicionar/estilizar botão, CTA, icon-button |
| [formularios.md](formularios.md) | Input, Select, Textarea, Checkbox, Switch, Label, search field, **filtro de período (ano → mês)** |
| [modais.md](modais.md) | Criar modal, dialog, confirmação, drawer, sheet, bottom-sheet mobile |
| [navegacao.md](navegacao.md) | Sidebar, header de página, tabs, chevrons, close buttons, back button |
| [cards-layout.md](cards-layout.md) | Page wrapper, max-width, grids, section titles, Card shadcn/KPI/ObraCard |
| [page-background.md](page-background.md) | Por que/onde o `--page-bg` é pintado, e como evitar a listra branca no fim das telas |
| [badges-status.md](badges-status.md) | Badge, pill de status, aprovado/reprovado/pendente, delta +/− |
| [tabelas.md](tabelas.md) | Tabela virtualizada (Análise/Versões), tabela HTML simples (IRR), GROUP_COLORS, formatação BR |
| [graficos.md](graficos.md) | Gráfico recharts (Bar/Line/Pie), paleta `STATUS_COLORS`, alturas, eixos, donut |
| [tooltips.md](tooltips.md) | Tooltip shadcn em card/KPI/botão e tooltip custom em gráfico |
| [icones.md](icones.md) | Escolher ícone lucide, tamanho, LottieIcon, SVG inline |
| [feedback.md](feedback.md) | Toast (Sonner), Skeleton, Progress, Loader, Alert, empty state |
| [emails/](emails/) | Templates HTML dos e-mails de Auth do Supabase (confirmação, convite, reset de senha, troca de e-mail) — colar direto em Auth → Email Templates no dashboard do Supabase |

## O que não se aplica ao Chaves na Mão

Esta pasta é uma cópia do design system do **rottas-control-hub**. Boa parte descreve telas e
componentes que não existem aqui. Ignore, nesta doc:

- **Análise / Versões / Planejamento / IRR / Empreendimentos** e tudo que dependa de
  `src/components/analise/shared.tsx` (`fMoeda`, `fNum`, `formatPct`, `GROUP_COLORS`, `levelClass`,
  `PlanilhaRow`) — esses arquivos não existem neste repo.
- **`ResponsiveModal`, `MobileTableShell`, `AlertDialog`, `useIsMobile`** — não foram portados.
  Aqui os modais usam `<Dialog>` do shadcn direto (11 pontos) e as tabelas HTML usam scroll
  horizontal com `max-md:hidden` nas colunas secundárias. A regra inegociável 3 e a parte do
  `AlertDialog` da regra 7 **não valem** neste app; o resto da 7 (destrutivo é sempre vermelho) vale.
- **`PeriodoFilter`**, **`LottieIcon`**, **`EyesIcon`**, **`SegmentedControl`**, **`pagination.tsx`**,
  **`SkeletonTableRows`** — não portados. Este repo tem 13 componentes em `src/components/ui/`,
  contra 51 lá.
- **`emails/`** — templates de Auth por e-mail do Supabase. Aqui o login é Microsoft Entra ID
  (ver `.claude/skills/auth-microsoft-entra/`), não há e-mail transacional de auth.
- **`marca.md` e `brand/`** — são a marca da Rottas. O Chaves na Mão tem logo próprio:
  `public/logo-chaves-na-mao.png`, sempre via `<Logo />` (`src/components/shared/Logo.tsx`).
  Valem daquele arquivo só as regras gerais (`object-contain`, `alt`, nunca recriar em SVG inline).
- **Dark mode** — os tokens `.dark` existem, mas nada adiciona a classe `dark`. Mesmo estado do
  repo de origem: suportado, não garantido.

O que **vale integralmente**: `tokens.md`, `tipografia.md`, `botoes.md`, `formularios.md`,
`cards-layout.md`, `page-background.md`, `badges-status.md`, `icones.md`, `feedback.md`,
`tooltips.md`.

> Duas correções já aplicadas nesta cópia, ainda pendentes no repo de origem: o `marca.md` dizia que
> `#f29f05` é `hsl(37 91% 55%)` (é `39 96% 48%`), e o `botoes.md` descrevia o hover de
> `outline`/`ghost` como laranja (é `hover:bg-muted`).

## Regras inegociáveis

1. **Formatação BR**: use `fMoeda` / `fNum` / `formatPct` de [src/components/analise/shared.tsx](../../src/components/analise/shared.tsx). Nunca crie `formatCurrency`/`formatBRL` local.
2. **Cores no JSX**: sempre via token Tailwind (`bg-primary`, `text-destructive`) ou CSS var. **Nunca** `#hex` literal — única exceção aceita: `#fcedd0`/`#f29f05` no botão "Escolha um orçamento" em `Analise.tsx` (legado).
3. **Shell de modal**: padrão único = `<ResponsiveModal>` de [src/components/ui/responsive-modal.tsx](../../src/components/ui/responsive-modal.tsx). Em mobile (< md / 768px) vira bottom-sheet via vaul (slide bottom-up, drag-to-dismiss, safe-area). Em desktop continua como Dialog centralizado. Para confirmações destrutivas tipo "Tem certeza?" use `<AlertDialog>` shadcn. Detalhes em [modais.md](modais.md).
4. **Close button `X`** em header de modal = `h-5 w-5`. Em pill/badge = `h-3 w-3`. Em input search = `h-4 w-4`. Ver [navegacao.md](navegacao.md).
5. **Chevrons**: `h-3.5 w-3.5` em trees/selects compactos, `h-4 w-4` em botões e seções colapsáveis.
6. **Antes de criar componente visual novo**: confira [src/components/ui/](../../src/components/ui/) (46 shadcn) e [src/components/shared/](../../src/components/shared/). Headers de página existentes: [AnaliseHeader](../../src/components/analise/AnaliseHeader.tsx), [VersaoHeader](../../src/components/analise/VersaoHeader.tsx).
7. **Botão destrutivo é sempre vermelho**: `Excluir`/`Remover`/`Descartar` usam `variant="destructive"` — inclusive o `AlertDialogAction` do diálogo de confirmação (`<AlertDialogAction variant="destructive">`). Laranja (`default`) é ação principal, nunca exclusão. Ver [botoes.md](botoes.md).
8. **Depois de alterar um padrão**: atualize o arquivo temático correspondente nesta pasta.

## Responsividade mobile (regra geral)

- **Breakpoint mobile**: `md` (768px) é a divisória de conteúdo. A sidebar usa `SIDEBAR_AUTO_COLLAPSE` (1050px) — token separado, não confundir.
- **Detecção via JS**: `useIsMobile()` de [src/hooks/use-mobile.tsx](../../src/hooks/use-mobile.tsx). Prefira prefixos Tailwind `max-md:` / `md:` quando der.
- **Tabelas largas**: envolva em `<MobileTableShell>` de [src/components/ui/mobile-table-shell.tsx](../../src/components/ui/mobile-table-shell.tsx) e marque colunas secundárias com `max-md:hidden`. Ver [tabelas.md](tabelas.md).
- **Modais**: use `<ResponsiveModal>` (vira bottom-sheet em mobile). Ver [modais.md](modais.md).
- **Safe-area iOS**: utilitários `safe-pt`, `safe-pb`, `safe-px`, `safe-mb` em [src/index.css](../../src/index.css). `viewport-fit=cover` já em [index.html](../../index.html).
- **Inputs em mobile**: o CSS global força `font-size: 16px` em `<input>` para evitar zoom automático no iOS — não sobrescrever.

## Padrões legados (não corrigir agora — apenas conviver)

- **Max-width de página divergente**: padrão `1400px`, mas Empreendimentos usa `1600px` e Perfil usa `1100px`. Ver [cards-layout.md](cards-layout.md).
- **SVG inline em `AppSidebar`**: `EyesIcon` é SVG inline, não lucide nem Lottie. Sidebar mistura 3 fontes de ícone. Ver [icones.md](icones.md).
- **Cores hardcoded em status badges**: `bg-green-100`, `bg-blue-50`, `text-red-500` convivem com tokens (`bg-success`). Ver [badges-status.md](badges-status.md).
- **Tamanhos de ícone não têm constante**: escala real `h-3` → `h-12` é documentada, não parametrizada. Ver [icones.md](icones.md).
- **3 estilos de Tooltip** convivem (default popover, light explícito `bg-white text-black`, dark invertido `bg-foreground text-background`). Componente novo deve usar o **default** (sem className de cor). Ver [tooltips.md](tooltips.md).
- **Paleta de gráfico não centralizada**: `STATUS_COLORS` (status de restrição) é a única constante compartilhada — vive em [irrCalc.ts](../../src/components/planejamento/irr/irrCalc.ts). Outros charts (INCC, Curva S) têm arrays hex privados. Ver [graficos.md](graficos.md).
- **Eixos de gráfico em hex literal**: `stroke="#e2e8f0"` (grid) e `fill: "#71717a"` (ticks) são duplicação de tokens (`--border`, `--muted-foreground`). Não unificar nesta passada. Ver [graficos.md](graficos.md).
