# Badges, Pills e Status

## Badge base

[src/components/ui/badge.tsx](../../src/components/ui/badge.tsx)

```
inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors
```

### Variants

| Variant | Resultado |
|---|---|
| `default` | Fundo laranja, texto branco (`bg-primary text-primary-foreground`) |
| `secondary` | Fundo preto, texto branco (`bg-secondary text-secondary-foreground`) |
| `destructive` | Fundo vermelho, texto branco |
| `outline` | Só borda + `text-foreground` |

## Badges customizadas em uso no app

| Caso | Classes | Tamanho |
|---|---|---|
| Status **ON** | `bg-success text-success-foreground text-[10px] px-2 py-0 h-5` | compacto |
| Status **OFF** | `variant="destructive" text-[10px] px-2 py-0 h-5` | compacto |
| "Em breve" | `variant="outline" text-[9px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30` | micro |
| "Beta" | `variant="outline" text-[9px] px-1.5 py-0 h-4 text-blue-500 border-blue-500/40` | micro |
| "Novo" (usuário recente) | `variant="outline" text-[9px] px-1.5 py-0 h-4 font-semibold text-blue-500 border-blue-500/40` | micro |
| Contador | `variant="secondary" text-xs` | default |

> **Selo "Novo" de usuário:** use o componente `NovoUsuarioBadge` (`src/components/NovoUsuarioBadge.tsx`),
> não repita as classes. Ele recebe `createdAt` e se auto-oculta quando o usuário tem ≥ `NOVO_USUARIO_DIAS`
> (30) dias — regra em `src/lib/usuarios.ts` (`isNovoUsuario`). Aparece na Home ("Equipe"),
> na página de perfil e no painel admin de Equipe.

---

## Status de domínio — cores reais em uso

> **Não estão unificadas em tokens.** Convivem cores diretas do Tailwind (`green-100`, `blue-50`) com tokens semânticos (`bg-success`, `bg-destructive`). Documentação descritiva abaixo — para badge **nova**, prefira tokens (`bg-success`, `bg-destructive`, `bg-primary`) a menos que o contexto exista na tabela.

### Fluxo de aprovação (Atualização Orçamentária)

Componente: [ApprovalTimeline.tsx](../../src/components/atualizacao/ApprovalTimeline.tsx), [AprovacaoModal.tsx](../../src/components/atualizacao/AprovacaoModal.tsx)

| Status | Estilo visual | Ícone |
|---|---|---|
| Aprovado | `bg-green-100 text-green-700` | `CheckCircle2` |
| Reprovado | `bg-red-100 text-red-700` (ou `text-red-500` só em delta) | `XCircle` |
| Pendente | sem badge; ícone `Clock` cinza | `Clock` |
| Em andamento | amber/âmbar (`bg-amber-100 text-amber-700`) | `Play` |

### Versão pill (Atualização)

```tsx
<span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
  Versão 3
</span>
```

Ver [AtualizacaoOrcamentaria.tsx](../../src/pages/AtualizacaoOrcamentaria.tsx).

### Delta orçamentário (Versões, comparações)

**Regra de negócio invertida** — aumento de valor é ruim, redução é bom:

| Delta | Cor | Classe |
|---|---|---|
| Aumento (+) | **Vermelho** | `text-red-500` |
| Redução (−) | **Verde** | `text-emerald-500` |

Ver [Versoes.tsx](../../src/pages/Versoes.tsx). Não inverta.

### % Saldo nas tabelas de Análise

| Valor | Cor |
|---|---|
| ≤ 50% | `text-green-600 font-semibold` |
| > 50% | `text-red-600 font-semibold` |

### Células de "Status" no Detalhamento de Insumo

Tabela do [InsumoDetailPanel](../../src/components/analise/InsumoDetailPanel.tsx) (abas Solicitações/Contratos/Pedidos/Cotação/Medição em `/analise`). Toda coluna cujo **nome exibido** contém "Status" pinta o fundo da célula conforme o valor (helper `statusCellClass`, casa por `normalizeTxt` — sem acento/caixa):

| Valor da célula | Cor |
|---|---|
| Concluído (contém "conclu") | `bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300` |
| Qualquer outro status (não vazio) | `bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300` |
| Vazio / nulo | sem cor |

### Indicador "online do Mega" (última sincronização do orçamento)

Ponto pulsante que mostra quando algo foi sincronizado, derivado de uma data/timestamp. Helper `megaSyncStatus(raw, thresholdHours = 24)` em [shared.tsx](../../src/components/analise/shared.tsx) retorna `{ stale, rel, short, full }`. Aceita tanto `date` puro (`YYYY-MM-DD`, ancorado à meia-noite local) quanto timestamp completo. O segundo parâmetro define o corte de "desatualizado":

| Uso | Fonte | `thresholdHours` |
|---|---|---|
| Orçamento atualizado pelo Mega | `orcamento.data_atualizacao` (date) | `24` (padrão) |
| Curva S sincronizada (`/planejamento`) | `obras_cadastro.curva_s_synced_at` (timestamp) | `24 * 7` (7 dias) |

| Estado | Cor | Animação |
|---|---|---|
| Dentro do limite (online) | `bg-success` | `animate-ping` (pulso) |
| Acima do limite (desatualizado) | `bg-destructive` | sem pulso |

Marcação padrão (ponto 2.5×2.5 com pulso):

```tsx
<span className="relative flex h-2.5 w-2.5" title={`Mega: atualizado ${sync.full} (${sync.rel})`}>
  {!sync.stale && <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />}
  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${sync.stale ? "bg-destructive" : "bg-success"}`} />
</span>
```

Em uso: barra de controles da [Analise.tsx](../../src/pages/Analise.tsx) (com `Tooltip`), [OrcamentoSelectorModal.tsx](../../src/components/analise/OrcamentoSelectorModal.tsx), [OrcamentosTab.tsx](../../src/components/empreendimentos/tabs/OrcamentosTab.tsx), [DetalhesOrcamentoModal.tsx](../../src/components/empreendimentos/DetalhesOrcamentoModal.tsx) e [DetalhesKPIsTab.tsx](../../src/components/empreendimentos/tabs/DetalhesKPIsTab.tsx) (com `title` nativo, por linha — todos no corte de 24h) e no cabeçalho "Última atualização" da Curva S em [CurvaSChart.tsx](../../src/components/analise/CurvaSChart.tsx) (corte de 7 dias). Como `data_atualizacao` é `date` (sem hora), na prática: atualizado hoje = verde, ontem ou mais antigo = vermelho.

### Etapa da SA (Aberturas de SA)

Pill na coluna Etapa da tabela de [AberturasSA.tsx](../../src/pages/AberturasSA.tsx). O **texto
é a etapa crua do Fabric** ("Conclusão MEGA", "Aprovação PCP"…); a **cor vem do status agrupado**
(`statusDaEtapa` → `STATUS_SA`), então tabela, filtro e gráfico usam a mesma classificação.

| Status | Pill |
|---|---|
| Em Correção | `bg-blue-100 text-blue-700` |
| Em Andamento (todas as etapas não listadas) | `bg-amber-100 text-amber-700` |
| Concluída (`Concluído`, `Concluído MEGA`) | `bg-green-100 text-green-700` |
| Cancelada | `bg-red-100 text-red-700` |

Marcação: `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium`.

### Draft vs Published (Reports)

| Status | Badge |
|---|---|
| draft | `variant="outline"` com texto "Rascunho" |
| published | `variant="default"` (laranja) com "Publicado" |

Ver [ReportFormFields.tsx](../../src/components/reports/ReportFormFields.tsx), [useReports.ts](../../src/hooks/useReports.ts).

---

## Regras ao adicionar status novo

1. **Prefira tokens** (`bg-success`, `bg-destructive`, `bg-primary`, `variant="outline"`) a cores Tailwind diretas.
2. Se o status expressa **regra de negócio** (tipo aumento = vermelho), documente aqui antes de codar.
3. Se a tela já usa cores Tailwind diretas (ex: `bg-green-100 text-green-700` no fluxo de aprovação), **mantenha consistência local** — não misture tokens com cores diretas no mesmo componente.
4. Badge de conteúdo efêmero (tag, flag beta) → `variant="outline"` com `text-[9px]` ou `text-[10px]`.
