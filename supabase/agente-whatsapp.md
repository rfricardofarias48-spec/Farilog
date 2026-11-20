# Contrato do agente de WhatsApp — Convocação de Escala

Este documento define **tudo que o agente externo precisa** para enviar as convocações,
acompanhar as respostas e alimentar o status que aparece no app do encarregado e no admin.

O app **não** envia WhatsApp automaticamente. Ele grava a intenção (linhas em
`public.convocacoes`) e mostra o status ao vivo. O agente é o único que envia mensagens e
atualiza os status.

---

## 1. Tabelas e view

| Objeto | Papel |
| --- | --- |
| `public.convocacoes` | 1 linha por ajudante convidado numa escala. Fonte da verdade do status. |
| `public.convocacao_eventos` | Log de cada mensagem enviada/recebida (auditoria e histórico). |
| `public.vw_convocacoes_agente` | Payload pronto: ajudante, telefone, empresa, endereço, valor, data/horário, vagas, `confirmados`. |

### Fila do agente (o que ele deve pegar)

```sql
-- Convocação a enviar (convite)
select * from public.vw_convocacoes_agente
 where status = 'pendente'
 order by data_servico, ordem;
```

Ao enviar o convite: `update public.convocacoes set status='enviada',
convite_enviado_em = now() where id = :id;` e insira o evento
(`direcao='out', tipo='convite', conteudo=<texto enviado>`).

---

## 2. Máquina de estados (`convocacoes.status`)

```
                    ┌────────────┐
  encarregado cria  │ pendente   │
                    └─────┬──────┘
             agente envia │  (convite + evento 'convite')
                          ▼
                    ┌────────────┐   sem resposta em 2h   ┌──────────────┐
                    │ enviada    │───────────────────────▶│ follow-up 2h │
                    └─────┬──────┘                         └──────┬───────┘
        aceitou ┌────────┼────────────────────────┐  sem resposta │
                ▼        ▼                         ▼               ▼
        ┌──────────┐ ┌──────────┐           ┌──────────────┐  ┌───────────────┐
        │confirmado│ │ reserva* │           │  recusado    │  │  sem_resposta │
        └──────────┘ └──────────┘           └──────────────┘  └───────────────┘
             ▲            │
             │    reserva acionada no dia D
             └────────────┘ (status vira 'enviada' → 'confirmado'/'falta')

  dia D sem confirmação (−30min + 5min de silêncio) → 'falta'  → aciona reserva
  fora do prazo / cancelado pelo encarregado         → 'cancelada'
```

- `*` **reserva**: quando o ajudante aceita mas as vagas já estão preenchidas
  (`confirmados >= vagas`). Ele fica na lista fechada, mas pode ser convocado se alguém faltar.

---

## 3. Regras de negócio

### 3.1 Convite (regra 1)
- Mensagem com **local, valor da diária, horário, data de pagamento** e, no fim,
  a pergunta se ele aceita.
- **2h depois** sem resposta: enviar **uma** mensagem curta perguntando de novo
  (`tipo='followup_2h'`, preencher `followup_enviado_em`).
- Sem resposta após o follow-up: `sem_resposta` (a vaga é liberada para reserva).

### 3.2 Limite de vagas (regra 2)
- Antes de gravar `confirmado`, contar `confirmados` da escala (coluna na view).
- Se `confirmados >= vagas`: **não** confirmar — gravar `status='reserva'`, evento
  `tipo='reserva'`, e avisar: "a lista foi fechada, mas você entra como reserva e
  ainda pode ser convocado".

### 3.3 Reservas (regra 3)
- Toda escala tem `total_reservas` (padrão **2**). O agente busca as reservas **sozinho**,
  **fora** da lista do encarregado, apenas ajudantes **ativos** (`funcionarios.status='active'`),
  dentro do `empresas.raio_km`.
- Um mesmo ajudante **pode** ser reserva de mais de uma escala se estiver no raio das duas
  e **não** tiver sido convocado (não esteja `confirmado`/`enviada` em escala no mesmo horário).
- Ao criar a reserva: inserir `convocacoes` com `papel='reserva'`, `status='pendente'`
  (ou `'reserva'` se já aceitou e a lista está cheia).

### 3.4 Confirmação no dia da escala (regra 4)
Relógio baseado em `escalas.horario` (início do serviço):

| Momento | Mensagem | `tipo` |
| --- | --- | --- |
| −1h | "Bom dia {nome}, tudo certo para {hora} na empresa {empresa}?" | `confirmacao_1h` |
| −40min | "{nome}, tudo certo para o serviço de hoje às {hora}?" | `confirmacao_40m` |
| −30min | "{nome}, preciso da sua confirmação ou irei considerar falta" | `confirmacao_30m` |

- Após a mensagem de −30min, aguardar **5min**. Se não houver resposta: **silenciar**,
  marcar `status='falta'` e **iniciar o contato com os reservas**.

---

## 4. Templates de mensagem (sugestão — o encarregado/agente pode ajustar)

**Convite**
```
Olá {primeiro_nome}, aqui é da FariLog.
Temos uma diária em {empresa} no dia {data}.
📍 Local: {endereco}
🕐 Horário: {hora}
💰 Valor: R$ {valor_diaria}
📅 Pagamento: {pagamento_em}

Você aceita a convocação?
```

**Follow-up (2h depois)**
```
{primeiro_nome}, você conseguiu ver a convocação da FariLog? Ainda posso contar com você?
```

**Lista fechada / reserva**
```
{primeiro_nome}, a lista desta convocação já foi fechada, mas te deixei como reserva —
se abrir uma vaga eu te aviso. Tudo bem?
```

**Dia D — −1h**
```
Bom dia {primeiro_nome}, tudo certo para {hora} na empresa {empresa}?
```

**Dia D — −40min**
```
{primeiro_nome}, tudo certo para o serviço de hoje às {hora}?
```

**Dia D — −30min**
```
{primeiro_nome}, preciso da sua confirmação ou irei considerar falta.
```

---

## 5. Como gravar as respostas (inbound)

Toda resposta recebida deve gerar um `convocacao_eventos` (`direcao='in'`,
`tipo='resposta'`, `conteudo=<texto>`) e atualizar `convocacoes`:

| Intenção detectada | `convocacoes.status` | Campos |
| --- | --- | --- |
| Aceita | `confirmado` (ou `reserva` se lotado) | `respondido_em = now()` |
| Recusa | `recusado` | `respondido_em = now()` |
| Dúvida / outro | mantém `enviada` e registra o evento | — |

O realtime de `public.convocacoes` propaga a mudança: o app do encarregado e a aba
**Convocação** do admin atualizam na hora.

---

## 6. Simulador (testes sem agente)

Enquanto o agente não estiver ativo, use a aba **Convocação** do admin para
**Aceitar / Recusar / Sem resposta** e testar o fluxo ponta a ponta — ela grava
exatamente os mesmos status que o agente gravaria.
