# Navegação — Sidebar, Header, Tabs, Chevrons, Close Buttons

## Sidebar

**Arquivos**: [src/components/AppSidebar.tsx](../../src/components/AppSidebar.tsx), shell shadcn em [src/components/ui/sidebar.tsx](../../src/components/ui/sidebar.tsx).

### Dimensões

| Estado | Largura |
|---|---|
| Expandida | `16rem` (256px) |
| Collapsed (icon-only) | `3rem` (48px) |
| Mobile (Sheet) | `18rem` (288px) |
| Auto-collapse abaixo de | `1050px` |
| Atalho de teclado | `b` |

### Cores por estado do item

| Estado | Classe / valor |
|---|---|
| Ativo | `bg-[#EEEFF4] text-gray-700` — fundo cinza discreto, texto cinza forte |
| Ícone ativo (lucide) | `text-gray-700` |
| Ícone ativo (Lottie) | cor `#374151` passada via prop |
| Inativo | `text-sidebar-foreground/70` |
| Hover | `hover:bg-sidebar-accent hover:text-sidebar-foreground` |
| Disabled | `text-sidebar-foreground/40 cursor-default` |

> **Item ativo não é mais laranja**: foi trocado de `#f59229` (laranja de marca) para cinza discreto (`#EEEFF4` fundo / `gray-700` texto e ícone) — decisão deliberada para reduzir destaque visual do item selecionado. `#f59229` como hex direto de marca não é mais usado no sidebar.

### Item — classes base

```
flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
```

Quando collapsed, muda para `w-8 h-8 p-0 justify-center rounded-lg mx-auto` via `group-data-[collapsible=icon]:!` modifiers.

### Estrutura de rotas atual

Definidas em `baseNavItems` em [AppSidebar.tsx:45-53](../../src/components/AppSidebar.tsx#L45-L53):

| Rota | Label | Ícone (tipo) | Visibilidade |
|---|---|---|---|
| `/home` | Home | `home.json` (Lottie) | Sempre |
| `/empreendimentos` | Empreendimentos | `Building2` (lucide) | Sempre — **cadeado** se sem acesso (ver abaixo) |
| `/analise` | Análise | `FileBarChart` (lucide) | Sempre — **cadeado** se sem acesso |
| `/planejamento` | Planejamento | `LineChart` (lucide) | Sempre — **cadeado** se sem acesso |
| `/versoes` | Versões | `History` (lucide) | Sempre — **cadeado** se sem acesso |
| `/atualizacao-orcamentaria` | Atualização | `RefreshCw` (lucide) | **Desktop apenas** (filtrada em mobile) — **cadeado** se sem acesso |
| `/incc` | INCC | `TrendingUp` (lucide) | Sempre — **cadeado** se sem acesso |

Itens do **`SidebarFooter`** (renderizados em separado, [AppSidebar.tsx:179-262](../../src/components/AppSidebar.tsx#L179)):

| Rota | Label | Ícone (tipo) | Visibilidade |
|---|---|---|---|
| `/novidades` | Novidades | `EyesIcon` (SVG inline em AppSidebar.tsx:29-33) | Sempre |
| `/admin` | Admin | `Shield` (lucide) | `accessLevel === "Nivel_01"` ou `can_view_admin`, **desktop apenas** |
| `/admin/tokens` | Integrações | `KeyRound` (lucide) | `accessLevel === "Nivel_01"` ou `can_view_admin`, **desktop apenas** |

Sidebar **mistura 3 fontes de ícone**: lucide-react (predominante), Lottie JSON (`home.json`), e SVG inline (`EyesIcon` para Novidades). Ao adicionar item novo, use **lucide** salvo se houver razão visual forte para Lottie. Ver [icones.md](icones.md).

> A rota `/reports` aparece em commits antigos como item principal — hoje virou `/novidades` no footer com ícone customizado. Não há `/reports` no `baseNavItems` atual.

### Footer de usuário

Avatar `h-7 w-7` com `AvatarFallback` `bg-primary text-primary-foreground text-[10px] font-semibold`. Nome `text-sm font-medium`, email `text-[11px] text-muted-foreground`. Dropdown com "Meu Perfil" (`Edit`) e "Sair" (`LogOut`).

### Logo

`public/Brand/rottas_logo_laranja.png` — `h-7 w-7` expandido, `h-6 w-6` collapsed, centralizado no topo.

### Persistência

Estado expandido/collapsed é salvo em cookie:

| Constante | Valor |
|---|---|
| Cookie name | `sidebar:state` |
| Max-age | `60 * 60 * 24 * 7` (7 dias) |
| Path | `/` |

Definidos em [src/components/ui/sidebar.tsx:15-16](../../src/components/ui/sidebar.tsx#L15-L16) e gravados em [sidebar.tsx:68](../../src/components/ui/sidebar.tsx#L68) sempre que o usuário toggla a sidebar. Ao logar/recarregar, o estado retorna do cookie.

### Badges no item de menu

Pequeno pill ao lado do label, em `text-[9px] px-1.5 py-0 h-4 font-medium` ([AppSidebar.tsx:158-167](../../src/components/AppSidebar.tsx#L158-L167)):

- **`Em breve`** — `Badge variant="outline"` em `text-muted-foreground border-muted-foreground/30`. Renderizada automaticamente quando `item.disabled === true`.
- **Custom** (ex: "Beta") — passe a string em `item.badge` no `NavItem`. Estilo `text-blue-500 border-blue-500/40`.

Ambas somem quando a sidebar está collapsed (`group-data-[collapsible=icon]:hidden` na `<span>` que envolve label+badges).

### Item bloqueado — sem acesso ao módulo (cadeado)

Módulos a que o usuário **não tem acesso** (`module_access` em `profiles`, via `hasModuleAccess`) **não são mais ocultados** — aparecem na sidebar **esmaecidos com um cadeado**, e o clique leva à tela de bloqueio (ver [feedback.md](feedback.md#tela-de-bloqueio-de-módulo)).

- **Estilo do item locked**: `text-sidebar-foreground/40` (mesmo dim do disabled), mas **com hover** (`hover:bg-sidebar-accent hover:text-sidebar-foreground/60`) porque continua clicável.
- **Ícone de cadeado**: `<Lock className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />` ao lado do label, dentro da mesma `<span>` dos badges (some no modo collapsed).
- **Clique**: navega normalmente pra rota (`navigate(item.to)`); o [ModuleGuard](../../src/components/ModuleGuard.tsx) intercepta e renderiza `<ModuleLockScreen>` — mesma tela vale para acesso por URL direta.
- **Não confundir com `disabled`** ("Em breve"): `disabled` não navega (mostra toast "Em breve!"); `locked` navega e cai na tela de bloqueio.
- **Novidades** (footer) e itens de admin continuam **ocultos** quando sem acesso — o padrão cadeado vale só para os módulos principais do `baseNavItems`.

---

## Navbar (header global do app)

[src/components/Navbar.tsx](../../src/components/Navbar.tsx) — header superior de toda página autenticada, dentro de [AppLayout](../../src/components/AppLayout.tsx).

## Header de página (dentro da main)

Padrão observado em Análise, Versões, Atualização, Planejamento: **o header é injetado via `createPortal`** para um slot `#header-slot` em AppLayout. Classes típicas:

```
bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap
```

Páginas com wrapper próprio (sem portal): **Home, Empreendimentos, Perfil, Novidades** — usam um `<header>` local.

Consulte [cards-layout.md](cards-layout.md) para o wrapper completo da página.

### Comportamento responsivo do header global (AppLayout)

- **Altura**: `min-h-12` em qualquer viewport. Em mobile (`< md`) o header pode crescer porque os itens injetados em `#header-slot` quebram linha (`flex-wrap`); em desktop (`md:flex-nowrap`) volta a ser uma linha única.
- **Padding**: `px-3 py-2 safe-pt safe-px` em mobile, `md:px-4 md:py-0` em desktop.
- **Cantos arredondados**: `md:rounded-l-2xl` no `SidebarInset` e `md:rounded-tl-2xl` no header — sem rounded em mobile (ocupa 100%).
- **Separator vertical** entre `SidebarTrigger` e `#header-slot` é escondido em mobile (`hidden md:block`) para economizar largura.
- **Botão Tutorial**: o label "Tutorial" some em telas estreitas (`hidden sm:inline`), restando só o ícone `PlayCircle`.
- **AIChatPanel**: em mobile (`< md`) ocupa `100dvh` × `100vw` (sem borda esquerda). Em `md+` mantém o painel lateral fixo de 420px.
- **AIChatButton (FAB)**: usa `safe-pb safe-pr` para respeitar o home indicator do iOS e fica em `bottom-4 right-4` em mobile (vs `bottom-6 right-6` em desktop).

---

## Tabs

[src/components/ui/tabs.tsx](../../src/components/ui/tabs.tsx) — Radix.

**`/admin` é a referência visual canônica** — segmented control padrão shadcn: pill de fundo `bg-muted p-1 rounded-md`, trigger ativo `bg-background text-foreground shadow-sm`, inativo transparente com `text-muted-foreground`. Nunca use cor de marca (laranja) no estado ativo de uma tab — isso é exclusivo do item ativo de outros contextos (ex.: badges), e mesmo lá o padrão atual não é mais laranja (ver seção Sidebar acima).

Usos atuais:
- **`/admin`** — `Tabs` para separar "Visão Geral", "Acessos", "Orçamentos/Equipes" etc. ([Admin.tsx](../../src/pages/Admin.tsx)). Padrão de referência.
- **`/planejamento`** e **`/incc`** — botões custom estilizados manualmente para *replicar* o visual do `TabsList`/`TabsTrigger` (não usam o componente Radix porque o conteúdo já é controlado por outro state machine) ([Planejamento.tsx](../../src/pages/Planejamento.tsx), [INCC.tsx](../../src/pages/INCC.tsx)). Ao criar uma tab nova com controle de estado próprio, copie essas classes em vez de reinventar.
  - Em `/incc`, isso vale só para as tabs de topo ("Orçamento" / "Tabela Análise"). Os chips de filtro abaixo (orçamento por tipo, período "Todos"/"Passadas"/"Mês atual"/"Futuras") são um padrão **diferente** — pill de filtro, não tab de navegação — e continuam usando `bg-[#f59229]/15 text-[#f59229]` no estado ativo. Não confunda os dois padrões.
- **Modal de empreendimento** ([EmpreendimentoModal](../../src/components/empreendimentos/EmpreendimentoModal.tsx)) — `Tabs` agrega 4 visões (Informações, Detalhes, Orçamentos, Ajustes de Aprovação) num único `ResponsiveModal`.
- **Seletor de orçamentos** ([OrcamentoSelectorModal](../../src/components/analise/OrcamentoSelectorModal.tsx)) — tabs Obras/Mitigatórias/Equipes/Outros com as classes replicadas (state próprio), incluindo badge de contagem por tab (`rounded-full`; ativo `bg-muted text-foreground`, inativo `bg-background/60`).
- **INCC** — `TabsList` com scroll horizontal em mobile (`overflow-x-auto snap-x snap-mandatory` + triggers `shrink-0 snap-start`). Ver exemplo em [tabelas.md](tabelas.md).

Regras:
- Prefira sempre o componente `Tabs`/`TabsList`/`TabsTrigger` de [tabs.tsx](../../src/components/ui/tabs.tsx). Só replique as classes manualmente (como em Planejamento) quando o conteúdo da aba não é filho direto de `Tabs` — nesse caso, mantenha as classes idênticas ao componente real.
- Use `TabsContent` com `forceMount` + `data-[state=inactive]:hidden` quando precisar **preservar estado** entre trocas de tab (ex: form parcialmente preenchido).
- Em mobile, `TabsList` ganha `overflow-x-auto max-md:snap-x max-md:snap-mandatory` e cada `TabsTrigger` recebe `shrink-0 max-md:snap-start`.
- Para alternar **modos de visualização** simples (não navegação), prefira botões `variant="ghost"` ou `Select` — `Tabs` é o padrão quando há conteúdo distinto por aba.

### SegmentedControl — filtro com estado próprio

[src/components/ui/segmented-control.tsx](../../src/components/ui/segmented-control.tsx) empacota as classes de `TabsList`/`TabsTrigger` para os casos em que o controle é um **filtro** (período, granularidade) e não há `TabsContent` — evita re-digitar a string de classes em cada tela.

```tsx
<SegmentedControl options={[{ value: "day", label: "Dia" }, …]} value={grain} onChange={setGrain} />
```

- `children` são renderizados como último item da pilha — use para triggers que não são `<button>` simples (ex.: o "Personalizado" com `Popover` + `Calendar` em `/admin`). Nesse caso aplique `segmentedItemClass(active)` no trigger.
- Union type explícito quando as `options` não cobrem todos os valores possíveis: `<SegmentedControl<PeriodMode> …>`.
- Em uso: filtro de período e granularidade dia/semana/mês do [/admin](../../src/pages/Admin.tsx). Padrão para filtros novos desse tipo — não crie mais linhas de `Button variant="outline"` lado a lado.

## Breadcrumb / Pagination

[breadcrumb.tsx](../../src/components/ui/breadcrumb.tsx) / [pagination.tsx](../../src/components/ui/pagination.tsx) existem mas **não estão em uso**. Considere se realmente precisa antes de introduzir.

## Back button

**Não há componente `BackButton`**. Quando é necessário, use:

```tsx
<Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
  <ArrowLeft />
  Voltar
</Button>
```

Raro — a navegação principal é pela sidebar, não por stack.

---

## Chevrons — tamanhos por contexto

| Contexto | Ícone | Tamanho |
|---|---|---|
| Expand/collapse em árvore (tabela Análise) | `ChevronRight`/`ChevronDown` | `h-3.5 w-3.5` |
| Indicador de dropdown compacto (header) | `ChevronDown` | `h-3.5 w-3.5` |
| Toggle de seção em modal (Resumo, Justificativas) | `ChevronRight`/`ChevronDown` | `h-4 w-4` |
| Collapse de card (AnaliseHeader) | `ChevronUp`/`ChevronDown` | `h-4 w-4` |
| Indicador hover em lista (user card) | `ChevronRight` (opacity 0 → 100) | `h-4 w-4` |
| Pagination (se vier a ser usado) | `ChevronLeft`/`ChevronRight` | `h-4 w-4` |

**Regra prática**: `h-3.5 w-3.5` para densidade alta (trees, inline compacto), `h-4 w-4` para o resto.

## Close buttons (X) — tamanhos por contexto

| Contexto | Tamanho |
|---|---|
| Header de modal (Dialog shadcn **e** custom overlay) | `h-5 w-5` |
| Clear em input de busca | `h-4 w-4` |
| Botão "limpar seleção" standalone | `h-3.5 w-3.5` |
| X dentro de pill/badge de filtro | `h-3 w-3` |

**No Dialog shadcn** o X já vem embutido — não adicione outro. No custom overlay, você mesmo renderiza.

## Arrows (ArrowLeft/ArrowRight)

Raros. Use `ArrowLeft` **apenas** para back button textual ou indicador de fluxo (step). **Para fechar modal não use ArrowLeft** — o padrão é X no canto.
