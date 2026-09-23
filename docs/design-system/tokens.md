# Tokens — Cores, Radius, Spacing, Dark Mode

**Fonte de verdade:** [src/index.css](../../src/index.css) (CSS vars) + [tailwind.config.ts](../../tailwind.config.ts) (mapping Tailwind).

---

## Cores — CSS vars e contexto

Cada var tem um uso específico; não substitua uma pela outra "parecida".

### Base neutra

| Token | HSL (light) | Quando usar |
|---|---|---|
| `--background` | `0 0% 100%` | Fundo da aplicação quando não há card por trás |
| `--foreground` | `0 0% 10%` | Texto principal (body) |
| `--card` | `0 0% 100%` | Fundo de **qualquer superfície elevada** (card, modal, header) |
| `--card-foreground` | `0 0% 10%` | Texto dentro de card |
| `--popover` | `0 0% 100%` | Popover, dropdown, tooltip content |
| `--muted` | `210 40% 96.1%` | Skeleton, fundo de header de tabela, bloco atenuado |
| `--muted-foreground` | `215.4 16.3% 46.9%` | Texto secundário, labels, subtítulos, placeholder |
| `--page-bg` | `0 0% 96.1%` (#F5F5F5) | Fundo de páginas **quando a página tem card principal flutuando** (Home, Perfil, Empreendimentos, Atualização). Não usar em Análise/Versões. |

### Marca (primary / accent)

| Token | HSL | Contexto |
|---|---|---|
| `--primary` | `39 96% 48%` (#f29f05) | Ação principal, link, foco. **Idêntico a `--accent`** — accent é usado pelo shadcn em hover de items (select, dropdown). |
| `--primary-foreground` | `0 0% 100%` | Texto sobre primary (sempre branco) |
| `--accent` | `39 96% 48%` | Mesmo valor; o shadcn distingue semanticamente (hover interno de componentes). Não crie cor diferente aqui sem motivo. |
| `--ring` | `39 96% 48%` | Focus ring (`focus-visible:ring-ring`). |

> **Sidebar ativo** não usa mais `--primary`/`#f59229`. Fundo `#EEEFF4` + texto/ícone `gray-700` (cinza discreto) — ver [navegacao.md](navegacao.md).

### Status

| Token | HSL | Quando usar |
|---|---|---|
| `--success` | `142 71% 45%` (#22c55e) | Badge "ON", status ativo, confirmações positivas em badges |
| `--success-foreground` | `0 0% 100%` | Texto sobre success |
| `--destructive` | `0 84.2% 60.2%` (#ef4444) | Botão destrutivo, badge "OFF", erro |
| `--destructive-foreground` | `210 40% 98%` | Texto sobre destructive |

> **3 "verdes" coexistem no código** — isto é **intencional**:
> - `--success` (#22c55e) → badges de estado ON/ativo
> - `text-green-600` → **regra de negócio**: % saldo ≤ 50% (bom) nas tabelas de Análise
> - `text-emerald-500` → delta de redução em Versões (redução de valor = bom)
>
> Da mesma forma há 2 "vermelhos": `--destructive` (badge OFF, erro) vs `text-red-500/600` (% saldo > 50%, delta de aumento = regra de negócio). **Não unifique** — os contextos são diferentes.

### Bordas e inputs

| Token | HSL | Uso |
|---|---|---|
| `--border` | `214.3 31.8% 91.4%` (#e2e8f0) | Borda de cards, separadores, linhas de tabela |
| `--input` | `214.3 31.8% 91.4%` | Borda de inputs, selects, textarea |
| `--secondary` | `0 0% 10%` | Botão preto (raro no app; usado em `variant="secondary"`) |
| `--secondary-foreground` | `0 0% 100%` | Texto sobre secondary |

### Sidebar

| Token | HSL | Uso |
|---|---|---|
| `--sidebar-background` | `0 0% 100%` (branco) | Fundo da sidebar |
| `--sidebar-foreground` | `240 5.3% 26.1%` | Texto da sidebar |
| `--sidebar-primary` | `39 96% 48%` | (não usado pelo item ativo — ver nota acima) |
| `--sidebar-accent` | `240 4.8% 95.9%` | Hover de item |
| `--sidebar-accent-foreground` | `240 5.9% 10%` | Texto sobre hover |
| `--sidebar-border` | `220 13% 91%` | Borda do header/footer da sidebar |
| `--sidebar-ring` | `39 96% 48%` | Focus ring na sidebar |

---

## Radius

Base: `--radius: 0.75rem` (12px). Tailwind mapeia:

| Classe | Valor computado | Uso típico |
|---|---|---|
| `rounded-sm` | 8px | Checkbox, tabs internas |
| `rounded-md` | 10px | **Input, Select, Button, Badge** |
| `rounded-lg` | 12px | Cards padrão, DialogContent |
| `rounded-xl` | 12px (fixo Tailwind) | Summary cards Home, ObraCard, items de sidebar |
| `rounded-2xl` | 16px (fixo Tailwind) | Cards do Perfil, SidebarInset, **modais custom overlay** |
| `rounded-full` | 9999px | Avatar, switch, pill/badge, progress bar, search pill |

---

## Spacing / Layout rápido

Detalhes completos em [cards-layout.md](cards-layout.md). Resumo:

| Valor | Uso |
|---|---|
| `space-y-6` | Entre seções grandes |
| `gap-6` | Grid principal |
| `gap-4` | Grid de cards |
| `gap-3` | Itens inline espaçados |
| `gap-2` | Ícone + texto em botão |

**Container global** (`tailwind.config.ts`): `center: true`, `padding: "2rem"`, `2xl: 1400px`.

**Breakpoints**:

| BP | Px | Uso |
|---|---|---|
| `sm` | 640 | Grid 2-col, layouts horizontais em modal |
| `md` | 768 | Grid 3-col |
| `lg` | 1024 | Grid 4/12-col |
| `xl` | 1280 | Grid 5-col (ObraCards) |
| `2xl` | 1400 | Container max |
| custom `1050` | — | Auto-collapse da sidebar |

---

## Dark Mode

**Status**: estratégia `darkMode: ["class"]` em [tailwind.config.ts](../../tailwind.config.ts). Variáveis redefinidas em `.dark` no [src/index.css](../../src/index.css#L53-L90).

**Uso real**: parcial. Componentes com classes `dark:` explícitas existem em gráficos (ex: [CurvaSChart](../../src/components/analise/CurvaSChart.tsx)), mas **não há toggle de UI** ativo. Considere o modo dark como **suportado mas não garantido** — não foque nele em features novas a menos que pedido.

### O que muda no dark

| Token | Light | Dark |
|---|---|---|
| `--background` | #fff | #121212 (7%) |
| `--foreground` | #1a1a1a | #f2f2f2 (95%) |
| `--card`, `--popover` | #fff | #1a1a1a (10%) |
| `--secondary` | #1a1a1a | #262626 (15%) |
| `--muted` | #f1f5f9 | #262626 (15%) |
| `--muted-foreground` | #64748b | #a6a6a6 (65%) |
| `--destructive` | #ef4444 | mais escuro (30.6%) |
| `--border`, `--input` | #e2e8f0 | #2e2e2e (18%) |
| `--sidebar-background` | #fff | #121212 |
| `--sidebar-accent` | #f4f4f5 | #1f1f1f (12%) |

### O que **NÃO** muda (intencional)

- `--primary`, `--accent`, `--ring`, `--sidebar-primary`, `--sidebar-ring` → sempre `#f29f05` (laranja da marca permanece).
- `--primary-foreground`, `--accent-foreground` → sempre branco.
- `--success` → não tem override `.dark` (usa o mesmo verde).

## Animações da landing/login

Os `@keyframes` vivem no fim de [src/index.css](../../src/index.css), usados só pelas três telas públicas — [Index](../../src/pages/Index.tsx), [Login](../../src/pages/Login.tsx) e [SolicitarCadastro](../../src/pages/SolicitarCadastro.tsx) — e pelo [ShowcasePanel](../../src/components/auth/ShowcasePanel.tsx). São as **únicas** animações custom do projeto fora das de accordion do `tailwind.config.ts`.

| Classe | Keyframe | Onde |
|---|---|---|
| `.lp-livedot` | `livedot` — halo verde pulsando, 2s infinito | Dots das pills "Conectado a" na hero. O delay escalonado (0 / 0,5 / 1 / 1,5s) vem de `style={{ animationDelay }}`, não do CSS. |
| `.lp-fadeup` | `fadeup` — opacidade + 10px de subida, 0,5s | Entrada da janela do produto e dos dois cards flutuantes. |
| `.lp-drawline` | `drawline` — `stroke-dashoffset` 520→0, 1,4s | Traçado das três linhas da curva S (SVG inline). |
| `.lp-livedot-white` | `livedotwhite` — mesmo halo, em branco | Chips de integração dentro do painel laranja, onde o verde sumiria. |
| `.lp-fadein` | `fadein` — só opacidade, 0,4s | Cascata das linhas da tabela e dos conectores da trilha no ShowcasePanel. |
| `.lp-growbar` | `growbar` — `scaleY` a partir da base, 0,6s | Barras do INCC no slide da curva S. |
| `.lp-pop` | `pop` — escala 0,7 → 1,06 → 1, 0,4s | Avatares aprovados da trilha e o círculo de check do estado enviado. |
| `.lp-pulseorange` | `pulseorange` — halo laranja, 2s infinito | Aprovador pendente e o passo "em análise" da timeline do cadastro. |

O delay de cada item vem sempre de `style={{ animationDelay }}`, nunca de uma classe por índice.

Todas são anuladas em `@media (prefers-reduced-motion: reduce)` — e o autoplay do carrossel também, via `matchMedia` no ShowcasePanel.
