# Ícones

O app mistura **3 fontes** de ícone: lucide-react (padrão), LottieIcon (animações específicas) e SVG inline (1 caso).

## Lucide-react — fonte padrão

Pacote `lucide-react` v0.462.0. Usado em 43+ arquivos.

### Escala de tamanhos (real, em uso)

| Classe | Px | Contexto |
|---|---|---|
| `h-3 w-3` | 12 | Dentro de pill/badge de filtro, lock/unlock de coluna, externalLink inline |
| `h-3.5 w-3.5` | 14 | Chevrons em tree/dropdown compacto, metadata no Perfil, botão "limpar seleção" |
| `h-4 w-4` | 16 | **Default.** Clear de input search, ícone em botão default, chevron de seção |
| `h-5 w-5` | 20 | Ícone de KPI card, header de card, **X em header de modal**, ícone em CTA grande |
| `h-6 w-6` | 24 | Ícone de título h1 (ex: Reports header) |
| `h-[18px] w-[18px]` | 18 | Ícone de item de sidebar |
| `h-10 w-10` | 40 | Ícone de overlay de bloqueio (ObraCard sem acesso) |
| `h-12 w-12` | 48 | Empty state hero |

> **Não existe constante `ICON_SIZES`**. A escala é descritiva. Para ícone novo, escolha o tamanho pelo contexto na tabela acima e não introduza valor intermediário (evitar `h-[13px]`, `h-[17px]`, etc.).

### Dentro de `<Button>`

O Button já aplica `[&_svg]:size-4`. **Não passe `className` de tamanho** no ícone filho — vai conflitar. Passe só se precisar outra cor:

```tsx
<Button><Edit />Editar</Button>   {/* 16px automático */}
```

### Ícones mais frequentes

`X`, `Loader2` (com `animate-spin`), `Search`, `ChevronDown/Up/Left/Right`, `Check`, `Building2`, `FileBarChart`, `FileText`, `RefreshCw`, `Wallet`, `Edit`, `Trash2`, `Download`, `Filter`/`FilterX`, `Lock`/`Unlock`, `Plus`, `Save`, `Bomb` (estouros), `MessageSquare`, `Eye`/`EyeOff`, `LogIn`/`LogOut`, `Clock`, `CheckCircle2`, `XCircle`, `Shield` (admin), `TrendingUp`.

### Como adicionar ícone novo

1. Procure primeiro em [lucide.dev](https://lucide.dev) — a lib está completa.
2. Importe: `import { IconName } from "lucide-react";`
3. Aplique tamanho da tabela de escala acima.
4. Para cor, use token: `className="text-primary"`, `"text-muted-foreground"`, etc. Não use hex.

---

## LottieIcon — para animação específica

Componente: [src/components/shared/LottieIcon.tsx](../../src/components/shared/LottieIcon.tsx)

Wrapper para JSONs Lottie com **override de cor via normalização HSL**. Suporta ref imperativo (`.play()`).

### Props

- `src` — caminho do JSON
- `size` — default `18`
- `color` — HSL override (aplicado em todas as curvas do JSON)
- `className`

### Arquivos Lottie atuais

| Arquivo | Uso | Cor ativa | Cor inativa |
|---|---|---|---|
| `public/icons/home.json` | Item "Home" da sidebar | `#374151` | `#71717a` |
| `public/icons/calendar.json` | Item "Versões" da sidebar | `#374151` | `#71717a` |

### Quando usar Lottie

Praticamente nunca para ícones novos. É pesado e não padronizado. Use **só** se o PM/design pedir animação clara (pulsar, morphing). Para ícone estático, **sempre lucide-react**.

---

## SVG inline — caso único: `EyesIcon` no sidebar

Em [src/components/AppSidebar.tsx](../../src/components/AppSidebar.tsx) há uma constante `EyesIcon` que é SVG inline (não lucide, não Lottie). **Legado**, não replique. Ao precisar migrar, prefira lucide equivalente (`Eye`) e remover o inline.

---

## Ícones por contexto — tabela de referência rápida

| Quero mostrar... | Use |
|---|---|
| Fechar modal/popover | `X` — `h-5 w-5` em modal, `h-4 w-4` em input |
| Loading | `Loader2` + `animate-spin` |
| Dropdown/select abre | `ChevronDown` `h-4 w-4 opacity-50` |
| Expand/collapse row | `ChevronRight`/`ChevronDown` `h-3.5 w-3.5` |
| Confirmação positiva | `CheckCircle2` |
| Erro/falha | `XCircle` ou `AlertCircle` |
| Aguardando | `Clock` |
| Ação: criar | `Plus` |
| Ação: deletar | `Trash2` |
| Ação: exportar | `Download` |
| Ação: editar | `Edit` |
| Filtro | `Filter` (ativo) / `FilterX` (limpar) |
| Busca | `Search` |
| Link externo | `ExternalLink` |
| Navegação (back) | `ArrowLeft` — **só back textual**, não como close |
