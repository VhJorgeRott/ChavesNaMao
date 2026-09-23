# Feedback — Toasts, Skeleton, Progress, Loader, Alert, Empty State

## Toasts — Sonner

Lib: `sonner`. Wrapper: [src/components/ui/sonner.tsx](../../src/components/ui/sonner.tsx). Provider montado em `App.tsx`.

### Configuração atual

| Propriedade | Valor |
|---|---|
| Posição | `top-right` |
| Theme | adaptativo (via `useTheme()` do `next-themes`) |
| Toast bg | `bg-background` |
| Toast text | `text-foreground` |
| Border | `border-border` |
| Shadow | `shadow-lg` |
| Description | `text-muted-foreground` |
| Action button | `bg-primary text-primary-foreground` |
| Cancel button | `bg-muted text-muted-foreground` |

### Uso

```tsx
import { toast } from "sonner";

toast.success("Versão salva com sucesso!");
toast.error("Erro ao salvar perfil");
toast.warning("Nenhum dado para exportar.");
toast.info("Em breve!");

// Com description
toast.error("Falha ao sincronizar", { description: err.message });
```

**Toast é o canal principal de feedback transacional** no app — não coloque mensagens inline em forms a menos que seja erro de campo específico.

### Aviso de nova versão (deploy)

[src/components/UpdatePrompt.tsx](../../src/components/UpdatePrompt.tsx) — montado no `App.tsx`, só roda em produção. A cada 5 min (e ao voltar o foco pra aba) refaz o fetch do `index.html`; como os assets têm hash de build, qualquer deploy muda o HTML. Detectou mudança → `toast.info("Nova versão disponível")` fixo (`duration: Infinity`) com action **Atualizar** que dá `window.location.reload()`. Mostra no máximo uma vez por sessão.

---

## Loader / Spinner

**Ícone padrão**: `<Loader2 className="h-4 w-4 animate-spin" />` (ou `h-5 w-5` em CTA).

```tsx
<Button disabled={loading}>
  {loading && <Loader2 className="animate-spin" />}
  {loading ? "Salvando..." : "Salvar"}
</Button>
```

Para full-screen loading, use skeleton em vez de spinner central.

---

## Skeleton

[src/components/ui/skeleton.tsx](../../src/components/ui/skeleton.tsx) — `<Skeleton className="h-4 w-32" />`. Fundo `bg-muted` com `animate-pulse`.

**Regra geral:** carregamento inicial de **conteúdo** (grid, cards, KPI) = skeleton. Ação em andamento (salvar, sincronizar) ou lista dentro de **modal** = spinner `Loader2`.

### Grids de tabela — `SkeletonTableRows`

Mesmo arquivo exporta `<SkeletonTableRows rows? colSpan? numericCols? />` — linhas prontas no formato dos grids do app (barra curta de código + descrição com larguras variadas `w-64/w-44/w-56` + colunas numéricas `w-20` pulsando). Renderiza `<tr>`s, então vai **dentro do `<tbody>`**:

```tsx
import { SkeletonTableRows } from "@/components/ui/skeleton";

<tbody>
  {loading && <SkeletonTableRows colSpan={colSpan} />}
  ...
</tbody>
```

- `rows` default 14 (≈ uma viewport); `numericCols` default 5.
- Sem `<table>` por perto (área ainda vazia)? Envolva numa tabela mínima: `<table className="w-full text-xs"><tbody><SkeletonTableRows /></tbody></table>` — assim o skeleton já fica no lugar onde o grid vai aparecer.
- Em uso: Análise, Versões, Máquinas, Atualização Orçamentária ("Carregando versão").

### Blocos de conteúdo (cards + gráfico)

Telas sem grid dominante (INCC, Planejamento Médio Prazo) usam blocos que ecoam o layout final — nada de spinner central:

```tsx
<div className="space-y-4">
  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
    {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
  </div>
  <Skeleton className="h-[400px] w-full rounded-xl" />
</div>
```

### Shell de boot (app inteira, antes de qualquer tela)

Entrar na app tem três esperas em sequência: bundle baixando (tela branca), sessão do `useAuth` resolvendo, perfil do `useUserProfile` resolvendo. Todas as três mostram o mesmo esqueleto de shell (sidebar + header + hero + 4 KPIs + bloco grande), nunca texto "Carregando...":

| Fase | Onde | Implementação |
|---|---|---|
| Antes do bundle rodar | `#boot` dentro do `#root` em [index.html](../../index.html) | HTML+CSS estáticos, hex literal (os tokens do CSS ainda podem não ter carregado). O `createRoot` limpa o `#root` no primeiro render, então não precisa de JS pra remover |
| Sessão resolvendo | [ProtectedRoute](../../src/components/ProtectedRoute.tsx) | `<AppShellSkeleton />` |
| Perfil resolvendo | [AppLayout](../../src/components/AppLayout.tsx) | `<AppShellSkeleton />` |

- [src/components/AppShellSkeleton.tsx](../../src/components/AppShellSkeleton.tsx) e o `#boot` do `index.html` são **gêmeos**: alterou um, altere o outro.
- O `#boot` é removido por um script inline nas rotas públicas (`/`, `/login`, `/cadastro`, `/convite`, `/reset-password`), que não usam o shell da app e piscariam o esqueleto errado.
- O conteúdo do shell é genérico de propósito (serve `/home`, `/analise`, etc.), não uma cópia fiel da Home.

### Onde skeleton NÃO entra

- **Modais** — spinner central simples (`Loader2 h-6 w-6 animate-spin text-primary`).
- **Botões/ações** — `Loader2` inline (ver seção Loader acima).
- **`ModuleGuard` e Login**: flash rápido, spinner basta.

---

## Progress

[src/components/ui/progress.tsx](../../src/components/ui/progress.tsx) — disponível mas pouco usado. Para barra linear simples com valor 0–100:

```tsx
<Progress value={pct} className="h-2" />
```

Para ring de progresso (ex: % saldo, % realizado), veja componentes em [src/components/analise/](../../src/components/analise/) que já implementam donut com Recharts.

---

## Alert (inline)

[src/components/ui/alert.tsx](../../src/components/ui/alert.tsx) — CVA com variants `default` e `destructive`. Use para aviso **persistente** dentro de um form ou tela (não transacional — para isso use toast).

```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Atenção</AlertTitle>
  <AlertDescription>Esta atualização está em revisão.</AlertDescription>
</Alert>
```

---

## Empty state

Não há componente `<EmptyState>` unificado. Padrão observado:

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum item ainda</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Crie a primeira novidade para aparecer aqui.
  </p>
  <Button onClick={create}>
    <Plus />
    Nova novidade
  </Button>
</div>
```

- Ícone hero: `h-12 w-12 text-muted-foreground`
- Título: `text-lg font-semibold`
- Descrição: `text-sm text-muted-foreground`
- CTA opcional

### Tela de bloqueio de módulo

[src/components/ModuleLockScreen.tsx](../../src/components/ModuleLockScreen.tsx) — tela cheia exibida pelo [ModuleGuard](../../src/components/ModuleGuard.tsx) quando o usuário acessa um módulo sem permissão (clicando no item cadeado da sidebar ou digitando a URL direta). **Substituiu** o antigo `toast.error` + redirect pra `/home`.

- Layout: `min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center`.
- Hero: cadeado `<Lock className="h-8 w-8 text-muted-foreground" />` dentro de círculo `h-16 w-16 rounded-full bg-muted`.
- Título `text-lg font-semibold`, descrição `text-sm text-muted-foreground max-w-sm` (inclui o nome do módulo quando disponível).
- CTA `<Button>` "Voltar ao Início" → `navigate("/home")`.
- Par do item cadeado na sidebar — ver [navegacao.md](navegacao.md#item-bloqueado--sem-acesso-ao-módulo-cadeado).

### Empty state especial — Análise

Quando nenhum orçamento está selecionado, a Análise mostra o botão pill legado (`bg-[#fcedd0] text-[#f29f05]` com `<Search className="h-5 w-5" />`). Documentado em [botoes.md](botoes.md#caso-especial--escolha-um-or%C3%A7amento-legado) — **não replique**.

---

## Tooltip

Resumo aqui — **detalhes completos** (3 estilos legados, tooltip em gráficos recharts, JustificativaPopover) em [tooltips.md](tooltips.md).

[src/components/ui/tooltip.tsx](../../src/components/ui/tooltip.tsx) — Radix. `TooltipProvider` já está montado no root. Use para:
- Esclarecer ícone-only buttons
- Exibir valor completo quando há truncate
- Mostrar fórmula ao passar o mouse em header de coluna

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon"><Info /></Button>
  </TooltipTrigger>
  <TooltipContent side="top" sideOffset={4}>
    Texto explicativo
  </TooltipContent>
</Tooltip>
```

> **Em código novo, omita `className` no `TooltipContent`** (use o default `bg-popover text-popover-foreground` do shadcn). Os estilos `bg-white text-black` e `bg-foreground text-background` que você verá no app são legados — ver [tooltips.md](tooltips.md).
