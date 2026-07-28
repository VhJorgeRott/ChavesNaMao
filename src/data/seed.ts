/**
 * Estado inicial do store em memória (demo). Reaproveita os dados sintéticos dos
 * adapters mock como fonte única para empreendimentos, unidades e clientes, e
 * adiciona entregas em diferentes etapas para popular as telas.
 *
 * Em produção este estado vem do Supabase (com RLS); aqui é só para renderizar e
 * navegar as páginas sem backend conectado.
 */

import {
  clientes as mockClientes,
  empreendimentos as mockEmpreendimentos,
  unidades as mockUnidades,
} from '@/adapters/mock-data';
import { env } from '@/lib/env';
import type {
  AccessTokenRec,
  AppUser,
  Assinatura,
  Cliente,
  Documento,
  Empreendimento,
  Entrega,
  ItemEntrega,
  ModeloTermo,
  Unidade,
  AuditEntry,
} from '@chaves/domain/types';

export interface DbState {
  empreendimentos: Empreendimento[];
  unidades: Unidade[];
  /**
   * ISO da última sincronização do catálogo com CV/Mega, por empreendimento.
   * É o que permite servir a listagem do cache e só revalidar quando envelhece
   * (ver `garantirUnidades` no DataProvider).
   */
  sincronizadoEm: Record<string, string>;
  clientes: Cliente[];
  entregas: Entrega[];
  itens: ItemEntrega[];
  documentos: Documento[];
  assinaturas: Assinatura[];
  tokens: AccessTokenRec[];
  auditoria: AuditEntry[];
  usuarios: AppUser[];
  modelos: ModeloTermo[];
}

const MODELO_PADRAO = `TERMO DE ENTREGA DE CHAVES

Contrato nº {{financeiro.contrato}}

Pelo presente instrumento, a Rottas Construtora e Incorporadora entrega ao(à) cliente {{cliente.nome}}, inscrito(a) no CPF {{cliente.cpf}}, as chaves da unidade {{unidade.identificacao}}, do empreendimento {{empreendimento.nome}}, em {{empreendimento.cidade}}/{{empreendimento.uf}}, com área de {{unidade.area}}.

Valor do contrato: {{financeiro.valorContrato}}.
Saldo devedor em aberto: {{financeiro.saldoDevedor}} ({{financeiro.parcelasEmAberto}} parcela(s) restantes).

O(A) cliente declara receber a unidade em perfeitas condições, dando plena quitação ao objeto deste termo.

{{empreendimento.cidade}}, {{data.hoje}}.


_______________________________
{{cliente.nome}}`;

const MODELO_CONFISSAO_DIVIDA = `INSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA E OUTRAS AVENÇAS

I. PARTES

1.1. Na qualidade de CREDORA, e assim doravante denominada:
ROTTAS CONSTRUTORA E INCORPORADORA LTDA., pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº. {{credor.cnpj}}, com sede em Curitiba/PR, na Rua Emiliano Perneta, nº. 174, andar 12, Bairro Centro, CEP 88.101-050, neste ato representada na forma de seu Contrato Social;

1.2. Na qualidade de DEVEDOR(A), e assim doravante denominado(a):
{{cliente.nome}}, {{cliente.nacionalidade}}, {{cliente.estadoCivil}}, {{cliente.profissao}}, inscrito no CPF/MF sob o nº. {{cliente.cpf}}, portador da Carteira de Identidade nº. {{cliente.rg}}, residente e domiciliado em {{cliente.endereco}}, endereço eletrônico {{cliente.email}}; e

______________________________, nacionalidade, estado civil, profissão, inscrito no CPF/MF sob o nº. ___.___.___-__, portador da Carteira de Identidade nº. __________, residente e domiciliado em __________, endereço eletrônico __________;

CREDOR(A) e DEVEDOR(A) estão aqui designados, em conjunto, como PARTES e, individualmente, como PARTE.

II. REGISTRO

2.1. Considerando que no dia __/__/____ as PARTES celebraram "Instrumento Particular de Promessa de Compra e Venda de Unidade Autônoma Imobiliária", no qual a CREDORA se comprometeu a vender e o(a) DEVEDOR(A) se comprometeu a comprar o imóvel constituído pela unidade imobiliária nº. {{unidade.identificacao}}, do Condomínio {{empreendimento.nome}}, localizado na cidade de {{empreendimento.cidade}}/{{empreendimento.uf}}.

2.2. Existem obrigações referentes ao pagamento das parcelas previstas no "Instrumento Particular de Promessa de Compra e Venda de Unidade Autônoma Imobiliária" em aberto, o que levou a CREDORA a adotar procedimentos extrajudiciais de cobrança através de seus advogados, tendo sido possível a composição, formalizada por meio do presente instrumento, conforme condições expressas adiante.

III. CONFISSÃO E CONDIÇÕES

3.1. O(A) DEVEDOR(A) reconhece e confessa dever à CREDORA a importância total de R$ {{divida.valorTotal}} ({{divida.valorTotalExtenso}}), referentes às parcelas do saldo devedor do "Instrumento Particular de Promessa de Compra e Venda de Unidade Autônoma Imobiliária", conforme "extrato do cliente".

3.2. As partes ajustam que o valor descrito no item 3.1, acima, será pago pelo DEVEDOR(A) à CREDORA, da seguinte forma:
{{divida.formaPagamento}}

3.2.1. Os valores das parcelas serão acrescidos de atualização monetária até os respectivos pagamentos com base na variação positiva do INCC-FGV, até a expedição do "Habite-se" do Empreendimento, e do IGP-M/FGV acrescidos de Juros de 12% a.a., a partir de tal evento, tendo como fator base o índice publicado no segundo mês anterior à assinatura deste Instrumento, e fator de atualização o índice publicado no segundo mês anterior ao do vencimento de cada parcela.

3.2.2. O saldo do valor da dívida será sempre atualizado do mesmo modo em que o serão suas parcelas e até sua completa quitação, de forma que, uma ou mais vezes durante o cumprimento deste contrato e mesmo após o pagamento da última parcela, poderá ser apurada e cobrada ou restituída, conforme o caso, qualquer diferença para mais ou para menos entre o valor que foi e o que deveria ter sido efetivamente quitado até o momento de apuração.

3.2.3. Considera-se automaticamente prorrogado o vencimento da parcela para o primeiro dia útil subsequente, caso o vencimento ocorra em finais de semana ou feriados.

3.3. Os pagamentos das parcelas serão efetuados através de boletos bancários a serem emitidos pela CREDORA, devidamente enviados ao(à) DEVEDOR(A) para o seu endereço eletrônico e/ou residencial, indicado no preâmbulo do presente instrumento. O não recebimento do boleto pelo DEVEDOR(A), por qualquer razão, não o(a) exime da obrigação de pagamento da respectiva parcela, sendo de sua responsabilidade entrar em contato com a CREDORA, através do endereço eletrônico contasareceber@rottasconstrutora.com.br ou do telefone (41)99872-0555, para informar eventual não recebimento e solicitar uma 2ª via do boleto, se for o caso.

3.4. Caso o presente Termo de Confissão de Dívida seja celebrado após o evento de entrega das chaves do Empreendimento realizado pela CREDORA, o DEVEDOR(A) declara ciência de que as chaves do imóvel somente serão disponibilizadas pela CREDORA após a comprovação da quitação integral da parcela definida como sinal neste Termo.

3.5. O inadimplemento ou impontualidade no pagamento de qualquer parcela deste acordo, implicará na revogação do parcelamento, podendo tornar, a critério exclusivo da CREDORA, independente de aviso ou notificação, imediatamente exigível a totalidade do saldo devedor (parcelas vencidas e vincendas deste Termo e/ou do Contrato de Compra e Venda), acrescido de (i) correção monetária pelo IGP-M, utilizando-se sempre, como base, a variação de 2 (dois) meses anteriores; (ii) juros de mora de 1,0% (um por cento) ao mês, calculados pro rata die a partir da data de vencimento da respectiva parcela; e (iii) multa de 2% (dois por cento) sobre o valor atualizado do débito, além do pagamento das despesas com notificações, cartoriais, honorários advocatícios, dentre outras, às quais der causa.

3.6. As Partes concordam que todas as obrigações, termos e condições estabelecidos no presente Termo são vinculativos e se estenderão aos sucessores, herdeiros, cessionários, promitente compradores e representantes legais de ambas as partes.

3.7. As partes concordam, ainda, que o atraso no cumprimento de qualquer obrigação prevista neste instrumento, ensejará comunicação do fato ao Serviço de Proteção ao Crédito (SPC)/ SERASA, bem como a qualquer outra instituição financeira e/ou de análise de crédito, independentemente de aviso ou notificação prévia.

IV. DISPOSIÇÕES FINAIS

4.1. O presente Termo não constitui novação da dívida, mantendo-se inalteradas todas as condições originais do Contrato de Compra e Venda.

4.2. O atraso no pagamento de qualquer parcela do acordo importará na imediata rescisão do presente acordo por culpa do DEVEDOR(A), ficando a CREDORA autorizada a distribuir Ação Judicial, independentemente de qualquer aviso ou notificação ao DEVEDOR(A). As partes manifestam ciência de que o presente termo servirá de título executivo extrajudicial, nos termos do artigo 784, III, do Código de Processo Civil.

4.3. Caso a CREDORA recorra à cobrança judicial do saldo devedor remanescente, além das sanções previstas no item 3.5 deste Termo, o(a) DEVEDOR(A) arcará, ainda, com o pagamento das custas judiciais e extrajudiciais, bem como dos honorários de advogado à razão de 20% (vinte por cento) do valor total das obrigações judicialmente cobradas.

4.4. A CREDORA poderá, eventualmente, por mera liberalidade, aceitar o pagamento em atraso das parcelas do acordo, sem que tal concessão se constitua em hipótese alguma, em renúncia dos seus direitos ou novação e/ou alteração das cláusulas ora pactuadas.

4.6. Considerando-se que o pagamento será feito em quotas periódicas, a quitação da última não estabelece a presunção de estarem quitadas as prestações anteriores, afastando-se, assim, a presunção prevista no artigo 322 do Código Civil.

4.7. Quitados todos os valores previstos neste acordo, a CREDORA concederá a(o) DEVEDOR(A), integral, irrevogável, plena e rasa quitação relativamente à totalidade do débito especificado na tabela do item 3.1 acima.

4.8. As PARTES reconhecem que a nulidade ou invalidade de qualquer das cláusulas contratuais não prejudicará a validade e eficácia das demais cláusulas e deste instrumento.

4.9. É dever das PARTES manter o endereço eletrônico e residencial, indicado no preâmbulo deste instrumento, sempre atualizado. Caso ocorra qualquer alteração, a PARTE comunicará à outra PARTE, por escrito, em até 48 (quarenta e oito) horas contadas a partir da respectiva alteração, sob pena de ser considerada válida qualquer comunicação enviada para o endereço, até então, cadastrado.

4.10. Todas as notificações e/ou avisos relacionados ao cumprimento deste instrumento, serão realizadas por escrito endereçadas às partes nos endereços eletrônicos ou residenciais indicados no preâmbulo deste instrumento.

4.11. Ficam ratificadas as demais cláusulas e condições estipuladas no "Instrumento Particular de Promessa de Compra e Venda de Unidade Autônoma Imobiliária" celebrado entre as PARTES, que não alteradas pelo presente instrumento, que passa a constituir, portanto, um só ato jurídico para todos os seus efeitos legais.

V. ASSINATURAS ELETRÔNICAS

5.1. As partes e testemunhas reconhecem válidas e plenamente eficazes a formalização e assinatura do presente instrumento por meios eletrônicos e digitais, constituindo, assim, título executivo extrajudicial para todos os fins de direito. Nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001, as partes expressamente concordam em utilizar e reconhecem como válida qualquer forma de comprovação de consentimento aos termos do presente instrumento em formato eletrônico, ainda que não utilizem de certificado digital emitido no padrão ICP-Brasil, incluindo as assinaturas eletrônicas nas plataformas de assinatura existentes no mercado para certificação das assinaturas, sendo esta suficiente para a validação e integral vinculação das partes ao presente instrumento. Portanto, fica expressamente atribuída validade jurídica ao presente documento, bem como às assinaturas e à página de certificação, as quais serão parte integrante deste instrumento.

VI. FORO

6.1. As partes elegem o Foro da Comarca de Curitiba/PR, para dirimir quaisquer dúvidas oriundas deste termo, de seus documentos integrantes e complementares, renunciando expressamente a outro que tenham ou venham a ter, por mais privilegiado que seja.

E por estarem justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor e valor, perante 2 (duas) testemunhas.

Curitiba/PR, {{data.hoje}}.


_________________________________________________________
ROTTAS CONSTRUTORA E INCORPORADORA LTDA.
CNPJ: {{credor.cnpj}}


_________________________________________________________
{{cliente.nome}} (DEVEDOR 1)
CPF: {{cliente.cpf}}


_________________________________________________________
__________ (DEVEDOR 2)
CPF: __________


TESTEMUNHAS:

_____________________________________________
Nome Completo: {{geral.testemunha1}}
RG:
CPF:

_____________________________________________
Nome Completo: {{geral.testemunha2}}
RG:
CPF:`;

const HASH_PLACEHOLDER = 'a'.repeat(64);

export const USUARIO_ADMIN: AppUser = {
  id: 'usr-admin',
  nome: 'Vitor Jorge',
  email: 'vitor.jorge@rottas.com.br',
  papel: 'admin',
  ultimaAtividade: '2026-06-22T13:00:00Z',
  avatarUrl: null,
  criadoEm: '2025-11-10T09:00:00Z',
};

const USUARIO_EQUIPE: AppUser = {
  id: 'usr-equipe',
  nome: 'João da Silva',
  email: 'joao.silva@rottas.com.br',
  papel: 'equipe_entrega',
  ultimaAtividade: '2026-06-21T18:20:00Z',
  avatarUrl: null,
  criadoEm: '2026-01-15T14:30:00Z',
};

/**
 * Há alguma integração em `live`?
 *
 * Com qualquer integração real ligada, o catálogo de demonstração NÃO pode
 * entrar no estado: ele apareceria misturado aos empreendimentos reais na tela
 * de Unidades e contaminaria a contagem do dashboard. Foi exatamente o que
 * aconteceu — "Residencial Jardim das Acácias" e "Loteamento Terras do Lago"
 * convivendo com os empreendimentos do CV.
 */
function algumaIntegracaoLive(): boolean {
  return (
    env.VITE_ADAPTER_MODE === 'live' ||
    env.VITE_CRM_MODE === 'live' ||
    env.VITE_ERP_MODE === 'live' ||
    env.VITE_ADMIN_MODE === 'live' ||
    env.VITE_PORTAL_MODE === 'live'
  );
}

/** Estado sem nenhum dado de demonstração — o que vale quando há integração real. */
function estadoVazio(): DbState {
  return {
    empreendimentos: [],
    unidades: [],
    sincronizadoEm: {},
    clientes: [],
    entregas: [],
    itens: [],
    documentos: [],
    assinaturas: [],
    tokens: [],
    auditoria: [],
    // Usuários e modelos continuam: o seletor de usuário de desenvolvimento e o
    // editor de termos precisam de algo enquanto o servidor não responde. Ambos
    // são substituídos pelos dados reais assim que carregam.
    usuarios: [USUARIO_ADMIN, USUARIO_EQUIPE],
    modelos: [],
  };
}

export function createInitialState(): DbState {
  if (algumaIntegracaoLive()) return estadoVazio();

  // Cópias para não mutar os arrays dos adapters mock.
  const unidades: Unidade[] = mockUnidades.map((u) => ({ ...u }));

  const entregas: Entrega[] = [
    {
      id: 'ent-0001',
      unidadeId: 'uni-0001',
      clienteId: 'cli-0001',
      status: 'DOCUMENTOS',
      responsavelId: USUARIO_ADMIN.id,
      iniciadaEm: '2026-06-18T12:00:00Z',
      concluidaEm: null,
      createdAt: '2026-06-18T12:00:00Z',
    },
    {
      id: 'ent-0002',
      unidadeId: 'uni-0005',
      clienteId: 'cli-0003',
      status: 'ASSINATURA',
      responsavelId: USUARIO_EQUIPE.id,
      iniciadaEm: '2026-06-15T09:30:00Z',
      concluidaEm: null,
      createdAt: '2026-06-15T09:30:00Z',
    },
    {
      id: 'ent-0003',
      unidadeId: 'uni-0002',
      clienteId: 'cli-0002',
      status: 'CONCLUIDA',
      responsavelId: USUARIO_ADMIN.id,
      iniciadaEm: '2026-05-30T14:00:00Z',
      concluidaEm: '2026-06-05T16:45:00Z',
      createdAt: '2026-05-30T14:00:00Z',
    },
  ];

  // uni-0002 já entregue (ent-0003 concluída).
  const u2 = unidades.find((u) => u.id === 'uni-0002');
  if (u2) u2.status = 'ENTREGUE';

  const documentos: Documento[] = [
    {
      id: 'doc-0001',
      entregaId: 'ent-0001',
      tipo: 'Termo de Entrega de Chaves',
      storagePath: 'entregas/ent-0001/termo-entrega.pdf',
      sha256Hash: HASH_PLACEHOLDER,
      geradoEm: '2026-06-19T10:00:00Z',
    },
    {
      id: 'doc-0002',
      entregaId: 'ent-0002',
      tipo: 'Termo de Entrega de Chaves',
      storagePath: 'entregas/ent-0002/termo-entrega.pdf',
      sha256Hash: HASH_PLACEHOLDER,
      geradoEm: '2026-06-16T11:00:00Z',
    },
    {
      id: 'doc-0003',
      entregaId: 'ent-0003',
      tipo: 'Termo de Entrega de Chaves',
      storagePath: 'entregas/ent-0003/termo-entrega.pdf',
      sha256Hash: HASH_PLACEHOLDER,
      geradoEm: '2026-06-01T09:00:00Z',
    },
  ];

  // A entrega concluída tem as DUAS assinaturas do processo: a confissão de
  // dívida (remota, Clicksign) e o recebimento de chaves (presencial, canvas).
  const assinaturas: Assinatura[] = [
    {
      id: 'ass-0003-confissao',
      entregaId: 'ent-0003',
      documentoId: 'doc-0003',
      canvasPngPath: null,
      metodo: 'CLICKSIGN',
      ip: '187.45.xxx.xxx',
      userAgent: 'Mozilla/5.0',
      geo: null,
      assinadaEm: '2026-06-02T10:15:00Z',
      clicksignDocKey: 'mock-doc-0003-abc',
      clicksignStatus: 'signed',
    },
    {
      id: 'ass-0003-recebimento',
      entregaId: 'ent-0003',
      documentoId: 'doc-0003',
      canvasPngPath: 'entregas/ent-0003/assinatura.png',
      metodo: 'CANVAS',
      ip: '187.45.xxx.xxx',
      userAgent: 'Mozilla/5.0',
      geo: null,
      assinadaEm: '2026-06-04T15:20:00Z',
      clicksignDocKey: null,
      clicksignStatus: null,
    },
  ];

  const itens: ItemEntrega[] = [
    { id: 'item-0003-1', entregaId: 'ent-0003', descricao: 'Chave da porta principal', quantidade: 2 },
    { id: 'item-0003-2', entregaId: 'ent-0003', descricao: 'Controle do portão', quantidade: 2 },
    { id: 'item-0003-3', entregaId: 'ent-0003', descricao: 'Manual do proprietário', quantidade: 1 },
  ];

  const tokens: AccessTokenRec[] = [
    {
      id: 'tok-0002',
      entregaId: 'ent-0002',
      tokenHash: 'b'.repeat(64),
      expiresAt: '2026-06-25T09:30:00Z',
      usedAt: null,
      scope: 'assinatura',
      createdAt: '2026-06-16T11:05:00Z',
    },
  ];

  const auditoria: AuditEntry[] = [
    {
      id: 'aud-1',
      actor: USUARIO_ADMIN.id,
      action: 'ENTREGA_INICIADA',
      entity: 'entrega',
      entityId: 'ent-0001',
      metadata: { unidade: 'uni-0001' },
      at: '2026-06-18T12:00:00Z',
    },
    {
      id: 'aud-2',
      actor: USUARIO_ADMIN.id,
      action: 'DOCUMENTO_GERADO',
      entity: 'documento',
      entityId: 'doc-0001',
      metadata: { tipo: 'Termo de Entrega de Chaves' },
      at: '2026-06-19T10:00:00Z',
    },
    {
      id: 'aud-3',
      actor: 'cliente:token',
      action: 'ASSINATURA_REGISTRADA',
      entity: 'entrega',
      entityId: 'ent-0003',
      metadata: { metodo: 'CLICKSIGN' },
      at: '2026-06-04T15:20:00Z',
    },
    {
      id: 'aud-4',
      actor: USUARIO_ADMIN.id,
      action: 'ENTREGA_CONCLUIDA',
      entity: 'entrega',
      entityId: 'ent-0003',
      metadata: {},
      at: '2026-06-05T16:45:00Z',
    },
  ];

  return {
    empreendimentos: mockEmpreendimentos.map((e) => ({ ...e })),
    unidades,
    sincronizadoEm: {},
    clientes: mockClientes.map((c) => ({ ...c })),
    entregas,
    itens,
    documentos,
    assinaturas,
    tokens,
    auditoria,
    usuarios: [USUARIO_ADMIN, USUARIO_EQUIPE],
    modelos: [
      {
        id: 'mod-0001',
        nome: 'Termo de Entrega de Chaves (padrão)',
        conteudo: MODELO_PADRAO,
        createdAt: '2026-06-01T12:00:00Z',
        updatedAt: '2026-06-01T12:00:00Z',
      },
      {
        id: 'mod-0002',
        nome: 'Termo de Confissão de Dívida (Venda Direta)',
        conteudo: MODELO_CONFISSAO_DIVIDA,
        createdAt: '2026-06-01T12:00:00Z',
        updatedAt: '2026-06-01T12:00:00Z',
      },
    ],
  };
}
