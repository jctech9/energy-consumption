# Energy Consumption

Aplicacao: https://jctech9.github.io/energy-consumption/

## Como o calculo e feito

A aplicacao parte de uma medicao real de consumo e projeta esse valor para um custo mensal.

Campos base:

- **kWh medido**: consumo registrado durante o periodo medido.
- **Horas** e **Dias**: duracao da medicao. A aplicacao soma os dois campos para descobrir o total de horas medidas.
- **Tarifa R$/kWh**: valor usado para calcular o custo. Se o registro nao informar tarifa, usa a tarifa padrao.
- **Dias no mes**: quantidade de dias usada na projecao mensal. Se o registro nao informar dias, usa os dias padrao.

Primeiro, a aplicacao calcula o consumo por hora:

```text
kWh por hora = kWh medido / horas medidas
```

Depois, o modo de calculo define como esse consumo sera projetado.

## Modos de calculo

### 24h ligado

Use para aparelhos que ficam ligados o dia inteiro, como geladeira, roteador, DVR, servidor, filtro ou equipamento em stand-by continuo.

Formula:

```text
kWh mensal = kWh por hora x 24 x dias no mes
custo mensal = kWh mensal x tarifa
```

Exemplo:

- Medicao: 0,208 kWh em 24 horas
- Dias no mes: 30
- Tarifa: R$ 0,83/kWh

```text
kWh por hora = 0,208 / 24 = 0,00867
kWh mensal = 0,00867 x 24 x 30 = 6,24 kWh
custo mensal = 6,24 x 0,83 = R$ 5,18
```

### Horas por dia

Use para aparelhos que consomem energia por uma quantidade previsivel de horas todos os dias, como TV, computador, ventilador, ar-condicionado ou iluminacao.

Formula:

```text
kWh mensal = kWh por hora x horas por dia x dias no mes
custo mensal = kWh mensal x tarifa
```

Exemplo:

- Medicao: 0,500 kWh em 2 horas
- Uso: 6 horas por dia
- Dias no mes: 24
- Tarifa: R$ 0,83/kWh

```text
kWh por hora = 0,500 / 2 = 0,250
kWh mensal = 0,250 x 6 x 24 = 36 kWh
custo mensal = 36 x 0,83 = R$ 29,88
```

### Por hora

Use quando voce quer saber o custo por hora e tambem projetar um uso mensal por quantidade de horas. Na pratica, a formula mensal e a mesma de "Horas por dia". Se o campo "Horas por dia" ficar vazio, a aplicacao considera 1 hora por dia.

Formula:

```text
custo por hora = kWh por hora x tarifa
kWh mensal = kWh por hora x horas por dia x dias no mes
custo mensal = kWh mensal x tarifa
```

Exemplo:

- Medicao: 1,200 kWh em 3 horas
- Uso: 1 hora por dia
- Dias no mes: 30
- Tarifa: R$ 0,83/kWh

```text
kWh por hora = 1,200 / 3 = 0,400
custo por hora = 0,400 x 0,83 = R$ 0,33/h
kWh mensal = 0,400 x 1 x 30 = 12 kWh
custo mensal = 12 x 0,83 = R$ 9,96
```

### Por uso

Use para aparelhos ou atividades que acontecem por ciclos, como maquina de lavar, secadora, forno eletrico ou uma rotina especifica.

Neste modo, o kWh medido ja representa um uso completo. A duracao em horas nao e obrigatoria para o calculo mensal.

Formula:

```text
kWh mensal = kWh medido x usos no mes
custo mensal = kWh mensal x tarifa
custo por uso = kWh medido x tarifa
```

Exemplo:

- Medicao: 0,900 kWh por ciclo
- Usos no mes: 12
- Tarifa: R$ 0,83/kWh

```text
kWh mensal = 0,900 x 12 = 10,8 kWh
custo mensal = 10,8 x 0,83 = R$ 8,96
custo por uso = 0,900 x 0,83 = R$ 0,75
```

### Periodo medido

Use quando voce nao quer normalizar o resultado para 24 horas, horas por dia ou usos no mes. A aplicacao mantem o proprio kWh medido como consumo mensal do registro.

Este modo e util para contas fechadas, leituras ja consolidadas ou medicoes que representam exatamente o periodo que voce quer registrar.

Formula:

```text
kWh mensal = kWh medido
custo mensal = kWh medido x tarifa
```

Exemplo:

- Medicao: 45 kWh
- Tarifa: R$ 0,83/kWh

```text
kWh mensal = 45 kWh
custo mensal = 45 x 0,83 = R$ 37,35
```

## Campos habilitados por modo

| Modo | Precisa de tempo medido | Usa horas por dia | Usa dias no mes | Usa usos no mes |
| --- | --- | --- | --- | --- |
| 24h ligado | Sim | Nao | Sim | Nao |
| Horas por dia | Sim | Sim | Sim | Nao |
| Por hora | Sim | Sim | Sim | Nao |
| Por uso | Nao | Nao | Nao | Sim |
| Periodo medido | Nao | Nao | Nao | Nao |

## Regras de validacao

- O nome do aparelho e obrigatorio.
- O kWh medido deve ser maior que zero.
- Para os modos que precisam de tempo medido, informe horas, dias ou os dois.
- O campo "Horas" aceita valores entre 0 e 23h59m.
- O campo "Dias" aceita valor zero ou maior.
- "Horas por dia" deve ficar entre 0,01 e 24 quando estiver habilitado.
- "Dias no mes" deve ficar entre 1 e 31 quando estiver preenchido.
- "Usos no mes" deve ser maior que zero quando estiver habilitado.
- A tarifa deve ser maior que zero quando estiver preenchida.

## Formatos aceitos para tempo medido

O campo de horas aceita texto em formatos como:

- `23h12m`
- `2h`
- `1:30`
- `90min`
- `3600s`

Tambem e possivel informar dias medidos no campo "Dias". A aplicacao converte dias para horas usando:

```text
1 dia = 24 horas
```

