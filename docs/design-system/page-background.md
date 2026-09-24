# Fundo de página — quem pinta o cinza

**Regra atual:** o fundo cinza (`--page-bg` = `0 0% 96%`) é pintado **uma vez só**, no scroll container do [AppLayout.tsx:55](../../src/components/AppLayout.tsx). Páginas internas **não precisam** mais setar `bg-[hsl(var(--page-bg))]` no wrapper raiz.

```tsx
// AppLayout.tsx — fonte única do fundo cinza
<div className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-[hsl(var(--page-bg))]">
  {children}
</div>
```

## O bug que isso resolve

Várias telas (Home, Perfil, Empreendimentos, Reports, Atualização Orçamentária etc.) tinham um wrapper raiz com `bg-[hsl(var(--page-bg))]` esperando preencher toda a área de conteúdo. Em algumas situações o cinza parava no meio da tela e o resto ficava **branco**, mostrando o `bg-background` que vem dentro do shadcn `<SidebarInset>` ([sidebar.tsx:277](../../src/components/ui/sidebar.tsx#L277)).

### Por que acontecia

A pilha de containers do AppLayout é:

```
SidebarProvider (flex min-h-svh)
└─ SidebarInset (h-screen overflow-hidden flex flex-col bg-background)   ← branco aqui
   ├─ <header>
   └─ <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">     ← scroll container
       └─ {children}                                                      ← wrapper da página
```

O wrapper da página tentava se esticar com `min-h-screen` ou `flex-1 min-h-full`. Os dois falham em casos comuns:

- **`min-h-screen`** = `100vh` do **viewport real**, não da área de scroll. Como o header come ~48px, o scroll container tem ~`100vh − 48px`. O wrapper fica 48px maior que o visível e ocasiona scroll desnecessário; pior, em telas curtas (mobile com URL bar) o cálculo de `vh` muda e o wrapper fica menor que o scroll container, deixando branco embaixo.
- **`flex-1 min-h-full`** depende do parent ter altura **explícita** para o `%` resolver. O scroll container tem `flex-1 min-h-0` (basis `0%`), o que em alguns engines não conta como altura definida → `min-h-full` colapsa → wrapper fica do tamanho do conteúdo → cinza para onde o conteúdo termina e o `bg-background` do `SidebarInset` aparece embaixo.

A correção estrutural é mover o cinza **para o scroll container**, que é o elemento que de fato ocupa toda a área disponível abaixo do header — sem depender de `vh`, `min-h-full` ou flex hacks.

## Convenção a partir de agora

### ✅ Faça
- Em páginas dentro do `AppLayout`, **não** ponha `bg-[hsl(var(--page-bg))]` no wrapper raiz da página. Já vem pronto do layout.
- Se a página precisa de **outra** cor de fundo (ex: branco puro `bg-background`, ou um tom específico de feature), aplique no wrapper da página normalmente — vai sobrescrever o cinza visualmente porque está em cima.
- Para páginas **fora** do `AppLayout` ([Login.tsx](../../src/pages/Login.tsx), [Welcome.tsx](../../src/pages/Welcome.tsx), [ResetPassword.tsx](../../src/pages/ResetPassword.tsx)), continue setando o fundo no wrapper raiz como hoje.

### ❌ Não faça
- `min-h-screen bg-[hsl(var(--page-bg))]` no wrapper raiz de página interna. Causa o gap descrito acima e ainda pode disparar scroll duplicado.
- Tentar usar `h-full` ou `min-h-full` no wrapper raiz para "garantir" que o cinza preencha — não é mais necessário e adiciona ruído.

## Telas com o padrão antigo (limpeza pendente)

Estas telas ainda têm `bg-[hsl(var(--page-bg))]` redundante no wrapper. Não é bug — só ruído. Pode remover ao tocar no arquivo:

- [src/pages/Home.tsx:108](../../src/pages/Home.tsx#L108)
- [src/pages/Perfil.tsx:110](../../src/pages/Perfil.tsx#L110), [Perfil.tsx:119](../../src/pages/Perfil.tsx#L119)
- [src/pages/Reports.tsx:63](../../src/pages/Reports.tsx#L63)
- [src/pages/ReportView.tsx:71](../../src/pages/ReportView.tsx#L71), [ReportView.tsx:84](../../src/pages/ReportView.tsx#L84), [ReportView.tsx:111](../../src/pages/ReportView.tsx#L111)
- [src/pages/ReportEditor.tsx:193](../../src/pages/ReportEditor.tsx#L193), [ReportEditor.tsx:204](../../src/pages/ReportEditor.tsx#L204)
- [src/pages/Admin.tsx:115](../../src/pages/Admin.tsx#L115), [Admin.tsx:124](../../src/pages/Admin.tsx#L124)
- [src/pages/AdminTokens.tsx:128](../../src/pages/AdminTokens.tsx#L128)

## Como testar

1. Abrir qualquer rota interna (`/home`, `/perfil`, `/novidades`, etc.).
2. Inspecionar o DOM e confirmar que o `<div class="flex-1 min-h-0 overflow-y-auto ... bg-[hsl(var(--page-bg))]">` está pintado.
3. Rolar até o fim do conteúdo: o cinza deve ir até o final da viewport, sem listra branca.
4. Em mobile (DevTools → iPhone SE), conferir que ao rolar com a URL bar aparecendo/sumindo o cinza nunca quebra.
