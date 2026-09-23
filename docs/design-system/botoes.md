# Botões

**Componente base**: [src/components/ui/button.tsx](../../src/components/ui/button.tsx) (CVA, shadcn padrão).

## Variants

| Variant | Classes | Usar para |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | **Ação principal** (Salvar, Criar, Confirmar) |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Deletar, descartar, reprovar |
| `success` | `bg-green-600 text-white hover:bg-green-700` | **Aprovar** (todo botão de aprovação do app usa este variant — nunca o laranja `default`, nem `bg-green-*`/`bg-emerald-*` à mão) |
| `outline` | `border border-input bg-background hover:bg-muted hover:text-foreground` | Ação secundária (Editar, Cancelar em forms) |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Fundo preto. Raro no app. |
| `ghost` | `hover:bg-muted hover:text-foreground` | Ações terciárias, icon-only, close, fechar |
| `link` | `text-primary underline-offset-4 hover:underline` | Link textual |

Nota: o hover de `outline` e `ghost` é cinza (`hover:bg-muted hover:text-foreground`), não laranja.

## Sizes

| Size | Altura | Padding |
|---|---|---|
| `default` | `h-9` (36px) | `px-4 py-2` |
| `sm` | `h-8` (32px) | `px-3 text-xs` |
| `lg` | `h-10` (40px) | `px-8` |
| `icon` | 36×36 | — (quadrado) |

## Estilos base que o CVA já aplica

Não repita estas classes inline — o Button já tem:

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
ring-offset-background transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
```

Observações:
- **Ícones filhos automaticamente viram `size-4`** (16px). Não precisa passar `className="h-4 w-4"` dentro de `<Button>`.
- `gap-2` entre ícone e texto já está aplicado.

## Padrões de uso

```tsx
// Ação principal
<Button onClick={save}>Salvar</Button>

// Secundária
<Button variant="outline" onClick={cancel}>Cancelar</Button>

// Com ícone
<Button variant="outline">
  <Edit />
  Editar Perfil
</Button>

// Icon-only
<Button variant="ghost" size="icon" aria-label="Fechar">
  <X />
</Button>

// Destrutiva
<Button variant="destructive">
  <Trash2 />
  Excluir
</Button>
```

## Ação destrutiva é SEMPRE vermelha (regra inegociável)

Qualquer botão que **apaga, remove ou descarta** (`Excluir`, `Remover`, `Descartar`, `Reprovar`,
reverter aprovação) usa `variant="destructive"`. **Nunca** o laranja do `default` — laranja é ação
principal comum; se o botão de excluir for laranja, a pessoa confirma no automático achando que é
o "confirmar" de sempre.

Vale também no rodapé do `AlertDialog` de confirmação. O `AlertDialogAction`
([src/components/ui/alert-dialog.tsx](../../src/components/ui/alert-dialog.tsx)) aceita `variant`:

```tsx
<AlertDialogFooter>
  <AlertDialogCancel>Cancelar</AlertDialogCancel>
  <AlertDialogAction variant="destructive" onClick={excluir}>Excluir</AlertDialogAction>
</AlertDialogFooter>
```

Sem `variant`, o `AlertDialogAction` cai no `default` (laranja) — correto só quando a confirmação
não destrói nada ("Sim, liberar", "Buscar Novos", "Atualizar Mega").

Não escreva `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"` nem
`bg-red-600` à mão: é o que o `variant` já faz.

## Caso especial — "Escolha um orçamento" (legado)

Empty state da Análise usa pill com cores hex literais:

```tsx
<button className="... bg-[#fcedd0] text-[#f29f05] ...">
  <Search className="h-5 w-5" />
  Escolha um orçamento
</button>
```

Em [src/pages/Analise.tsx](../../src/pages/Analise.tsx). **Legado documentado** — não replique esse estilo em novos botões. Use `variant="default"` ou `variant="outline"` normal.
