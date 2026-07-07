import { Link } from 'react-router-dom';
import { LegalH2, LegalLayout, LegalP, LegalUl } from '@/components/layout/LegalLayout';

export function TermosDeUso(): React.JSX.Element {
  return (
    <LegalLayout titulo="Termos de Uso" atualizadoEm="07/07/2026">
      <LegalP>
        Estes Termos de Uso regulam o acesso e a utilização da plataforma <strong>Chaves na
        Mão</strong>, disponibilizada pela <strong>Rottas Construtora e Incorporadora</strong>{' '}
        (&ldquo;Rottas&rdquo;) aos seus clientes. Ao marcar o aceite na tela de login e utilizar a
        plataforma, você declara ter lido, compreendido e concordado com estes Termos e com a{' '}
        <Link to="/politica-de-privacidade" className="text-primary underline-offset-2 hover:underline">
          Política de Privacidade
        </Link>
        .
      </LegalP>

      <LegalH2>1. O que é a plataforma</LegalH2>
      <LegalP>
        O Chaves na Mão é um canal digital criado para facilitar a vida do cliente que adquiriu uma
        unidade em empreendimento da Rottas. Por meio dele, você acessa as informações do seu
        contrato, do seu empreendimento e da sua unidade, além de acompanhar o processo de entrega
        das chaves — tudo em um só lugar, sem depender do envio manual de documentos.
      </LegalP>

      <LegalH2>2. Acesso</LegalH2>
      <LegalUl>
        <li>
          O acesso é feito exclusivamente por login com conta Microsoft (Microsoft Entra ID). A
          plataforma não armazena senha própria.
        </li>
        <li>
          A conta de acesso é pessoal e intransferível. Você é responsável por manter a
          confidencialidade das suas credenciais Microsoft.
        </li>
        <li>
          Ao entrar, a plataforma identifica automaticamente o empreendimento e a unidade
          vinculados ao seu contrato.
        </li>
      </LegalUl>

      <LegalH2>3. Uso adequado</LegalH2>
      <LegalP>
        Você se compromete a utilizar a plataforma apenas para as finalidades a que se destina,
        não tentar acessar dados de outros clientes e não praticar qualquer ato que comprometa a
        segurança ou a disponibilidade do serviço.
      </LegalP>

      <LegalH2>4. Dados pessoais</LegalH2>
      <LegalP>
        O tratamento dos seus dados pessoais está descrito na{' '}
        <Link to="/politica-de-privacidade" className="text-primary underline-offset-2 hover:underline">
          Política de Privacidade
        </Link>
        . Em resumo: coletamos apenas o necessário para operar a plataforma (nome, e-mail e dados
        do seu contrato/empreendimento), armazenamos com segurança e{' '}
        <strong>
          não utilizamos seus dados para publicidade paga, tráfego pago ou marketing, nem os
          vendemos ou compartilhamos com terceiros para esses fins
        </strong>
        .
      </LegalP>

      <LegalH2>5. Exclusão da conta</LegalH2>
      <LegalP>
        Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), você pode
        excluir sua conta a qualquer momento em <strong>Perfil → Excluir minha conta</strong>. A
        exclusão é permanente e irreversível: todas as informações da sua conta na plataforma serão
        apagadas. Documentos que a Rottas tenha obrigação legal ou contratual de manter (por
        exemplo, contratos assinados) permanecem guardados pelos prazos exigidos em lei.
      </LegalP>

      <LegalH2>6. Disponibilidade e alterações</LegalH2>
      <LegalP>
        A Rottas se esforça para manter a plataforma disponível, mas pode haver interrupções para
        manutenção ou por motivos alheios ao seu controle. Estes Termos podem ser atualizados; a
        data da última atualização consta no topo desta página.
      </LegalP>

      <LegalH2>7. Contato</LegalH2>
      <LegalP>
        Em caso de dúvidas sobre estes Termos, entre em contato com a Rottas pelos canais oficiais
        de atendimento.
      </LegalP>
    </LegalLayout>
  );
}
