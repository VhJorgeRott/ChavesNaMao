-- =============================================================================
-- Chaves na Mão — modelos de termo no servidor
-- =============================================================================
-- Os modelos viviam apenas no store em memória do navegador: editar um termo se
-- perdia no refresh, e não havia de onde uma Edge Function ler o texto para
-- gerar o PDF que vai à assinatura.
--
-- Passam a morar aqui, que é o lugar certo por dois motivos: é o texto que o
-- cliente assina (a verdade tem de ser do servidor, não do navegador de quem
-- clicou), e a geração do PDF acontece server-side.

create table if not exists modelos (
  id           uuid primary key default gen_random_uuid(),
  external_ref text unique,
  nome         text not null,
  conteudo     text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table modelos enable row level security;

-- Mesma regra das demais tabelas operacionais: a equipe interna opera, o resto
-- não enxerga. DELETE segue negado — remover modelo é raro e destrutivo.
create policy modelos_select on modelos
  for select to authenticated using (public.is_equipe());
create policy modelos_insert on modelos
  for insert to authenticated with check (public.is_equipe());
create policy modelos_update on modelos
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());

create trigger trg_modelos_touch
  before update on modelos
  for each row
  execute function public.touch_updated_at();

-- Modelos padrão. `on conflict do nothing` mantém a migração repetível e não
-- sobrescreve edições que a equipe já tenha feito.
insert into modelos (external_ref, nome, conteudo) values
  ('mod-0001', 'Termo de Entrega de Chaves (padrão)', 'TERMO DE ENTREGA DE CHAVES

Contrato nº {{financeiro.contrato}}

Pelo presente instrumento, a Rottas Construtora e Incorporadora entrega ao(à) cliente {{cliente.nome}}, inscrito(a) no CPF {{cliente.cpf}}, as chaves da unidade {{unidade.identificacao}}, do empreendimento {{empreendimento.nome}}, em {{empreendimento.cidade}}/{{empreendimento.uf}}, com área de {{unidade.area}}.

Valor do contrato: {{financeiro.valorContrato}}.
Saldo devedor em aberto: {{financeiro.saldoDevedor}} ({{financeiro.parcelasEmAberto}} parcela(s) restantes).

O(A) cliente declara receber a unidade em perfeitas condições, dando plena quitação ao objeto deste termo.

{{empreendimento.cidade}}, {{data.hoje}}.


_______________________________
{{cliente.nome}}'),
  ('mod-0002', 'Termo de Confissão de Dívida (Venda Direta)', 'INSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA E OUTRAS AVENÇAS

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
CPF:')
on conflict (external_ref) do nothing;
