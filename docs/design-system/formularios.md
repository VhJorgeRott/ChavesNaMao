# Formulários e Inputs

Componentes base em [src/components/ui/](../../src/components/ui/). Altura padrão de campo: **`h-9`** (36px), alinhando com Button default.

## Input

[src/components/ui/input.tsx](../../src/components/ui/input.tsx)

```
h-9 w-full rounded-md border border-input bg-background px-3 py-2
text-base md:text-sm
placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:cursor-not-allowed disabled:opacity-50
```

> **`text-base` em mobile, `md:text-sm` em desktop** é intencional (evita zoom do iOS ao focar).

## Textarea

[src/components/ui/textarea.tsx](../../src/components/ui/textarea.tsx) — mesmos estilos de borda/foco do Input. `min-h-20` (80px).

## Select

[src/components/ui/select.tsx](../../src/components/ui/select.tsx) — Radix. Trigger herda aparência do Input (`h-9 rounded-md border border-input`).

- Indicador de dropdown: `<ChevronDown className="h-4 w-4 opacity-50" />` (já embutido no trigger).
- Item selecionado marca com `<Check className="h-4 w-4" />` à esquerda.
- Hover em item: `focus:bg-accent focus:text-accent-foreground` (laranja).

```tsx
<Select value={v} onValueChange={setV}>
  <SelectTrigger className="w-[280px]">
    <SelectValue placeholder="Selecione..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Opção A</SelectItem>
  </SelectContent>
</Select>
```

### Select com grupos coloridos (opções que são colunas da tabela)

Quando as opções do select **são as colunas de um grid**, herde a cor do grupo (`GROUP_COLORS`,
ver [tabelas.md](tabelas.md)) em vez de listar tudo em cinza — o usuário reconhece a opção pela
cor antes de ler o label. Referência: seletor de campo em
[FormulaBuilderModal](../../src/components/atualizacao/FormulaBuilderModal.tsx).

Três peças:

1. **`SelectLabel`** (cabeçalho do grupo): `sticky top-0 z-10 bg-popover` (o `bg-popover` opaco
   impede os itens de vazarem por trás ao rolar), envolvendo um span com faixa
   `hexToRgba(cor, 0.14)`, swatch `h-3 w-3 rounded-sm` e texto `text-[10px] uppercase tracking-wide`.
2. **`SelectItem`**: barra lateral por um `box-shadow` inset de 3px na cor do grupo, via `style`.
   Inset shadow e não um `<span>` filho — os filhos do `SelectItem` entram no `ItemText` do Radix
   e vazariam para o trigger quando a opção estivesse selecionada.
3. **`SelectTrigger`**: quando o item mostra só a parte curta do label (o grupo já está no
   cabeçalho), monte o valor à mão — swatch + label completo — em vez de `<SelectValue />`.

O `SelectItem` do shadcn já tem `pl-8` (reservado ao `<Check />` em `left-2`), então a barra de 3px
na borda esquerda não colide com o indicador.

**Cor entra por `style`, nunca hex no JSX** — o mapa `groupId → hex` vem por prop de quem é dono
da tabela. Ver regra 2 do [INDEX.md](INDEX.md).

## Checkbox

[src/components/ui/checkbox.tsx](../../src/components/ui/checkbox.tsx)

- `h-4 w-4`, `border-primary`, `rounded-sm`.
- Checked: `bg-primary text-primary-foreground` + ícone `Check h-4 w-4`.

## Filtro de período (ano → mês)

[src/components/ui/periodo-filter.tsx](../../src/components/ui/periodo-filter.tsx) — **use este
componente sempre que a tela filtrar por mês.** Não recrie a árvore nem troque por um `<Select>`
comprido: com dois anos de base a lista solta vira uma rolagem cega.

Um `Popover` com árvore **ano → mês**: o ano é a linha-pai (chevron `h-3.5` + contagem de meses
à direita), os meses ficam indentados em `pl-7`. Abre com o **ano mais recente expandido**. O
gatilho é uma **pill** (`rounded-full px-3 py-1.5 text-xs font-semibold border`), que fica
`bg-primary/15 text-primary border-primary/30` quando há seleção e neutra quando não há.

Dois modos, mesma casca:

| `modo` | Controle | Estado | Comportamento |
|---|---|---|---|
| `"single"` | `<input type="radio">` | `selecionado: string \| null` | Um mês por vez; escolher **fecha** o popover. O ano não é selecionável, só expande. Sem "limpar" — sempre há um mês. |
| `"multi"` | `<input type="checkbox">` | `selecionados: Set<string>` | Checkbox também no ano (com `indeterminate` quando parcial) e botão **limpar** no cabeçalho. Seleção vazia = "Todos os períodos". |

A chave de cada mês é **a string que você passou** em `meses` — o componente só lê os 7
primeiros caracteres (`YYYY-MM`) pra montar a árvore. Então `"2026-07"` e `"2026-07-01"`
funcionam sem conversão na chamada.

Rótulo do gatilho: em `single`, o mês escolhido (`Jul/2026`); em `multi`, `Todos os períodos` →
o mês (1 selecionado) → `N períodos`.

**Em uso:** [MetasTab](../../src/components/metas/MetasTab.tsx) (`single`) e
[IRRDateFilter](../../src/components/planejamento/irr/IRRDateFilter.tsx) (`multi`, Médio Prazo),
que hoje é só um wrapper que extrai as datas-limite das restrições.

⚠️ O `accent-color` dos inputs nativos usa `accent-primary`. O componente nasceu no Médio Prazo
com `#f59229` cravado; virou token na extração — a cor na tela é praticamente a mesma
(`--primary` é `37 91% 55%`).

## Switch

[src/components/ui/switch.tsx](../../src/components/ui/switch.tsx)

- Container `h-6 w-11 rounded-full`. Thumb `h-5 w-5`.
- **Checked usa `bg-green-500`** (não `bg-primary`) — divergência intencional do padrão shadcn. Não "corrija" para primary.
- Unchecked: `bg-input`.

## Label

[src/components/ui/label.tsx](../../src/components/ui/label.tsx) — `text-sm font-medium leading-none`. Use sempre acompanhando um input.

## Search field — padrão do app

Buscas **não** usam `<Input>` puro — é um `<div class="relative">` com ícone dentro. Padrão visto em [Empreendimentos.tsx](../../src/pages/Empreendimentos.tsx), [Analise.tsx](../../src/pages/Analise.tsx):

```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <input
    className="w-full pl-9 pr-10 py-2 rounded-lg border border-border bg-card text-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    placeholder="Buscar..."
    value={q}
    onChange={(e) => setQ(e.target.value)}
  />
  {q && (
    <button
      type="button"
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
      onClick={() => setQ("")}
      aria-label="Limpar busca"
    >
      <X className="h-4 w-4" />
    </button>
  )}
</div>
```

- Search icon: `h-4 w-4 text-muted-foreground`
- Botão clear (X): `h-4 w-4` (não `h-5 w-5` — este é input, não modal header).
- Radius: **`rounded-lg`** no input de busca, **não** `rounded-md`. Essa é a escolha do app.

## React Hook Form

Existe [src/components/ui/form.tsx](../../src/components/ui/form.tsx) (wrapper shadcn), **mas** formulários atuais do domínio (ex: [ReportFormFields](../../src/components/reports/ReportFormFields.tsx)) usam controle manual de state + validação por `toast.error` no submit. Não há `FormMessage` global com borda vermelha.

Se adicionar validação visual:
- Erro em input: `border-destructive focus-visible:ring-destructive`.
- Mensagem: `text-sm text-destructive mt-1`.
- Toast permanece como feedback principal.
