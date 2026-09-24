# Tabelas e Data Grids

> O app tem **três padrões**: tabela HTML virtualizada (Análise, Versões), `<Table>` shadcn (raro), e `<table>` HTML simples para grids de domínio com badges/células custom (IRR). Escolha conforme o volume e o conteúdo das células.

## Escolha

| Volume / conteúdo | Use |
|---|---|
| < ~100 linhas estáticas, células de texto/número | [src/components/ui/table.tsx](../../src/components/ui/table.tsx) (shadcn) |
| Milhares de linhas, colunas resizáveis, pinned, árvore | Tabela HTML virtualizada com `@tanstack/react-virtual` |
| Grid pequeno (< ~200 linhas) com **badges/células custom** e lógica de domínio | `<table>` HTML simples + `border-b` + cores de status — exemplo [IRRTabela.tsx](../../src/components/planejamento/irr/IRRTabela.tsx) |

## Formatação de valores — **sempre reutilize**

[src/components/analise/shared.tsx](../../src/components/analise/shared.tsx) exporta:

| Função | Formato | Exemplo |
|---|---|---|
| `fMoeda(val)` | `R$ X.XXX` (0 decimais) | `R$ 1.234` |
| `fNum(val, dec?)` | `X.XXX,XX` (default 2 decimais) | `1.234,50` |
| `formatPct(val)` | `XX,X%` (×100, 1 decimal) | `47,1%` |

- Todas tratam `null`/`undefined`/`NaN` retornando `"-"`.
- `fBRL2` (2 decimais de BRL) existe só em [InsumoDetailPanel](../../src/components/analise/InsumoDetailPanel.tsx) — é local, não exportado; use apenas dentro daquele componente.
- **Nunca** crie `formatCurrency`/`formatBRL` novo. Importe de `shared.tsx`.

Também exportado: `baseIdLinha()` — remove sufixo de versão (`__YYYY-MM-DD`) do `id_linha` para lookup cross-version. Tipo `PlanilhaRow` também fica em `shared.tsx` — não redefina.

---

## GROUP_COLORS — cores das colunas da tabela Análise

Definidas em [shared.tsx](../../src/components/analise/shared.tsx) via `GROUP_COLORS`. **Semântica estabelecida**, não mude sem autorização:

| Grupo | Header (hex) | Cell (rgba do header) | Dado | Texto do header |
|---|---|---|---|---|
| `orcado` | `#9ca3af` | 15% opacity | Valores orçados (Qtd, Unit, Total) | `text-gray-900` |
| `realizado` | `#ffd988` | 20% | Realizados (com NF) | `text-gray-900` |
| `contrato` | `#427bde` | 20% | Contratos firmados | `text-white` |
| `pedido` | `#d695ff` | 20% | Pedidos emitidos | `text-white` |
| `comprometido` | `#f6787b` | 20% | Pedido + Contrato + Realizado | `text-white` |
| `solicitacao` | `#1f6d63` | 20% | Solicitações | `text-white` |
| `saldo` | `#6b7280` | 20% | Orçado − Comprometido | `text-white` |
| `projecao` | `#22c55e` | 15% | Projeção da atualização | `text-gray-900` |
| `anterior` | `#f59e0b` | 12% | Projeção anterior | `text-gray-900` |
| `resultado` | `#0ea5e9` | 12% | Projeção + Comprometido | `text-white` |

### Colunas base (sem grupo)

Header: `bg-muted text-muted-foreground`. Colunas: N, Cód. Estrut., Código, Nível, Descrição, Uni. Medida.

### Cores por nível de hierarquia (`levelClass()`)

| Nível | Classes |
|---|---|
| 1 | `bg-primary text-primary-foreground font-bold` |
| 2 | `bg-orange-200 text-orange-900 font-semibold` |
| 3 | `bg-orange-100 text-orange-800 font-medium` |
| 4 | `bg-[#e0e0e0] text-gray-900 font-semibold` |
| Insumo | `bg-card text-foreground` |

### Indicadores em célula

- % Saldo ≤ 50%: `text-green-600 font-semibold`
- % Saldo > 50%: `text-red-600 font-semibold`

---

## Tabela virtualizada — parâmetros

Usada em [src/pages/Analise.tsx](../../src/pages/Analise.tsx) e `Versoes.tsx`.

| Propriedade | Valor |
|---|---|
| Biblioteca | `@tanstack/react-virtual` |
| Altura da linha estimada | `28px` |
| Overscan | `20` linhas |
| Container | `overflow-y-auto` com ref para virtualizer |
| Colunas fixas | Sticky left até coluna "pinada" pelo usuário |
| Resize de coluna | Drag que atualiza CSS var `--col-{id}-width` |
| Largura mínima de coluna | `50px` |

### Header

- Colunas base: `bg-muted text-muted-foreground` via `headTextCls()`
- Colunas coloridas: `headStyle()` aplica background sólido + texto branco/escuro conforme grupo
- Peso: `font-medium` (helper `headTextCls`)
- Altura: `28px` (virtualizado) ou `h-12 px-4` (Table shadcn)
- Sticky: condicional por `pinnedColumnId`

### Cell

- Número: `text-right whitespace-nowrap`
- Texto: `text-left whitespace-nowrap overflow-hidden text-ellipsis`
- Centro (N, Código, Nível, Unidade): `text-center`
- Padding: compacto no virtualizado; `p-4` no Table shadcn

### Linha

- Hover (Table shadcn): `hover:bg-muted/50`
- Seleção: `data-[state=selected]:bg-muted`
- Borda inferior: `border-b`
- Cor de fundo: combinação de `levelClass()` (linha) + `cellStyle()` (célula por grupo)

---

## Tabela HTML simples (grid de domínio) — IRR

Padrão observado em [IRRTabela.tsx](../../src/components/planejamento/irr/IRRTabela.tsx) — grid pequeno com badges de status/predecessora, agrupamento pai/filhos com chevron e seleção de linha.

### Quando usar

- Dados pequenos (< ~200 linhas) — não precisa de virtualização.
- Células com **lógica de exibição própria** (status badge, predecessora, link, ícone condicional) que tornariam o `cellStyle()` da virtualizada complicado demais.
- Não há necessidade de resize / pin de coluna pelo usuário.

### Estrutura

```tsx
<div className="bg-card border border-border rounded-xl overflow-hidden">
  <div className="overflow-auto max-h-[70vh]">
    <table className="w-full text-xs">
      <thead className="bg-primary text-primary-foreground sticky top-0 z-10">
        <tr>
          <th className="text-left px-3 py-2.5 font-bold">…</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-border/30 bg-card hover:bg-muted/40 cursor-pointer">
          <td className="px-3 py-1.5 text-foreground whitespace-nowrap">…</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

| Detalhe | Valor |
|---|---|
| Container | `bg-card border border-border rounded-xl overflow-hidden` |
| Scroll | `overflow-auto max-h-[70vh]` no wrapper interno |
| Header | `bg-primary text-primary-foreground sticky top-0 z-10`, `px-3 py-2.5 font-bold` |
| Linha pai (agrupamento) | `bg-orange-200 text-orange-900 font-semibold` (mesmas classes do nível 2 da virtualizada) |
| Linha filha | `bg-orange-50 hover:bg-orange-100/60` |
| Linha simples (modo flat) | `bg-card hover:bg-muted/40` |
| Borda inferior | `border-b border-border/30` (filhas) ou `border-b border-border/50` (pai) |
| Linha selecionada | `style={{ backgroundColor: "#f5e72a" }}` (highlight amarelo, IRRTabela:94) |
| Chevron de expand | `ChevronRight`/`ChevronDown` `h-3.5 w-3.5` (ver [navegacao.md](navegacao.md)) |

### Badges de status / predecessora

[IRRTabela.tsx:20-46](../../src/components/planejamento/irr/IRRTabela.tsx#L20-L46) define `StatusBadge` e `PredecessoraBadge` reutilizando `STATUS_COLORS` de [irrCalc.ts](../../src/components/planejamento/irr/irrCalc.ts):

```tsx
const StatusBadge = ({ status }) => {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {status}
    </span>
  );
};
```

`${color}26` = 15% alpha em hex. Reutilize esse formato em qualquer pill de domínio que precise de fundo translúcido na cor da fonte. **`PredecessoraBadge` usa hex hardcoded `#22c55e`/`#ef4444`** porque os valores são booleanos visuais, não enum de status — é divergência consciente e local.

### Divergências conscientes vs. tabelas.md

- **Não usa `GROUP_COLORS`** — não há grupos de coluna como em Análise; cada coluna é independente.
- **Não usa `MobileTableShell`** — o wrapper já tem `overflow-auto` próprio; embrulhar seria duplo overflow.
- **Não tem `hideOnMobile` em colunas** — em mobile o usuário rola horizontalmente. Aceitável para o domínio IRR onde a tabela não é a UI principal.
- Header com `bg-primary text-primary-foreground` em vez de `bg-muted text-muted-foreground` — destaque visual da tabela "principal" da tela. Reaproveite só quando a tabela for o foco da página; tabelas secundárias devem usar `bg-muted`.

### Quando replicar este padrão

Se você for criar um novo grid de domínio com badges, **reutilize**:

- `STATUS_COLORS` de `irrCalc.ts` se o eixo for status de restrição/atividade.
- O componente `StatusBadge` e `PredecessoraBadge` (copy-paste se forem específicos; extraia para shared se forem genéricos).
- A estrutura de container/header/linha acima.

Não recrie o padrão divergindo das classes — quanto mais a estrutura visual for igual, mais fácil é evoluir tudo junto no futuro.

---

## Mobile (< md / 768px)

Tabelas largas (`Análise`, `Versões`, `INCC`) **não viram cards** em mobile. Mantêm o `<table>` com scroll horizontal e ocultam colunas secundárias.

### `MobileTableShell`

[src/components/ui/mobile-table-shell.tsx](../../src/components/ui/mobile-table-shell.tsx) — wrapper opcional que adiciona `overflow-x-auto` + sombra de borda (fade) quando há overflow horizontal e respeita `safe-pb`. Use em tabelas pequenas/estáticas que não estão dentro de containers já com `overflow-auto`. Para os grids virtualizados de `Análise`/`Versões`, o container pai já trata o scroll — não embrulhe em `MobileTableShell` (causaria duplo overflow).

```tsx
<MobileTableShell>
  <table className="min-w-[1200px]">…</table>
</MobileTableShell>
```

### `hideOnMobile` em `ColumnDef`

[ColumnFilter.tsx](../../src/components/analise/ColumnFilter.tsx) define `hideOnMobile?: boolean` em `ColumnDef`. Em [shared.tsx](../../src/components/analise/shared.tsx) já vem marcado em colunas secundárias dos grids `Análise`/`Versões`:

- **Sempre visíveis em mobile:** `descricao`, `codigo`, e a coluna `Total` (`vlr_*`) de cada grupo (Realizado, Contrato, Pedido, Comprometido, Solicitação) + `vlr_saldo` + `pct_saldo`.
- **`hideOnMobile: true`:** `n`, `estrut`, `nivel`, `unidade`, `qtd_orcada`, `vlr_unitario`, todas as `qtd_*` por grupo, todas as `vlr_medio_*`, `qtd_saldo`, `vlr_medio_saldo`.

Aplique a classe `max-md:hidden` no `<th>` e no `<td>` quando `col.hideOnMobile === true`. Exemplo (já aplicado em `Analise.tsx`/`Versoes.tsx`):

```tsx
<th className={`… ${col.hideOnMobile ? "max-md:hidden" : ""}`}>…</th>
<td className={`… ${col.hideOnMobile ? "max-md:hidden" : ""}`}>…</td>
```

### Filtros como Sheet em mobile

A toolbar de filtros (`FilterPanel` em `Análise`/`Versões`) é um popover absoluto em desktop. Em mobile (`useIsMobile()`), o gatilho "Filtros" abre um `<Sheet side="left">` (90vw) contendo o mesmo `FilterPanel`. O resto da toolbar (Detalhes, Estouros, Colunas, Excel, Versionar, Dash) usa `flex-wrap` e cai em duas linhas naturalmente.

### Barra de ação inferior (`/atualizacao-orcamentaria`)

Em mobile, os botões "Ajustes de Aprovação" e "Nova Atualização" saem da toolbar (`max-md:hidden`) e viram uma barra fixa no rodapé com `safe-pb`, sombra superior e cada botão ocupando 50% (`flex-1`). O scroll de cards recebe `pb-[env(safe-area-inset-bottom)]` para não esconder o último card atrás da barra.

### Tabs scroll-snap (`/incc`)

A `TabsList` (Orçamento, Tabela Análise) recebe `overflow-x-auto snap-x snap-mandatory` com cada tab `shrink-0 snap-start` para rolar suavemente quando o título ultrapassa a largura da tela.

### KPIs em grid 2×2 (`/incc`)

`INCCTableKPIs` usa `grid-cols-2 md:grid-cols-4` — 4 cards em desktop, 2×2 em mobile. O strip de tipos de orçamento (Viabilidade/Lançamento/Executivo/Atualização) usa `grid-cols-2 md:flex md:overflow-x-auto`.

---

## Paginação de tabelas e listas — padrão

Toda tabela/lista paginada client-side segue o padrão da tabela de SAs
([src/pages/AberturasSA.tsx](../../src/pages/AberturasSA.tsx)) usando o shadcn
[`src/components/ui/pagination.tsx`](../../src/components/ui/pagination.tsx) — **não** usar
botões "Anterior/Próxima" soltos.

Anatomia (rodapé da tabela, dentro do card, `border-t border-border p-3`):

- Esquerda: `Página {X} de {Y}` (`text-xs text-muted-foreground whitespace-nowrap`).
- Direita: `<Pagination className="mx-0 w-auto justify-end">` com:
  - Setas `‹`/`›` (`ChevronLeft`/`ChevronRight` `h-4 w-4`) nas pontas; quando desabilitada,
    `pointer-events-none opacity-40` (não some — mantém o layout estável).
  - Números com a página atual em `isActive` (variant outline). Itens `h-8 w-8`, número em `text-xs`.
  - Reticências `PaginationEllipsis` nos saltos.

Janela de números: **importe** o helper `pageList(current, total)` (0-based) de
`@/components/ui/pagination`. ≤ 7 páginas mostra todas; senão mostra
**1, 2, … vizinhas da atual …, penúltima, última**:

```
‹  1  2  …  8  9  10  …  46  47  ›
```

Regras:
- Trocar filtro ou ordenação **reseta pra página 1**.
- `PAGE_SIZE` padrão: 20 linhas.
- Só renderizar o rodapé quando `totalPages > 1`.

## ColumnFilter — reutilize

[src/components/analise/ColumnFilter.tsx](../../src/components/analise/ColumnFilter.tsx) — popover para toggle de visibilidade de colunas. **Reutilize** nas novas tabelas do domínio em vez de reimplementar.

## Exportação Excel

- Util compartilhado: [`src/lib/exportExcelEstilizado.ts`](../../src/lib/exportExcelEstilizado.ts) — **exceljs** (escrita, import dinâmico) + `file-saver`. O `xlsx` (SheetJS) ficou só pra **leitura** (ImportExcelModal e parsers).
- O Excel espelha a tela: `GROUP_COLORS` (header sólido + tint das células pré-composto por alpha-blend) e `levelClass` (fundo/fonte por nível). Números saem como **número com `numFmt`** (`"R$" #,##0`, `#,##0.00`, `0%`) — nunca string formatada pt-BR.
- Nome do arquivo: `analise_{codigo}_{YYYY-MM-DD}.xlsx` (padrão).
- Usa dados filtrados + colunas ativas, não o dataset bruto (exceção: Atualização Orçamentária exporta snapshot completo).
- Doc completa: [export-excel-estilizado.md](../guias/export-excel-estilizado.md).
