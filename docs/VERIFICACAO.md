# Verificação — 23/10/2026

## Expansão de combate, gráficos e coleção

Esta seção cobre a expansão atual. Os benchmarks e registros de navegador mais abaixo são de uma versão anterior e **não medem os novos encontros com até 160 inimigos**.

Foi mantida a distribuição estática, sem dependências novas, build ou serviços externos. Os novos arquivos de execução são `actor-sprites.js` e `progression.js`. O cenário e a abertura conservaram a paleta; raridades usam nomes e uma a quatro marcas.

Verificações da expansão:

- Execução final de `npm test`: **77 testes aprovados, zero falhas**, em aproximadamente 12 segundos. Sintaxe de todos os módulos de execução válida; HTML com 73 IDs únicos e tags balanceadas.
- Testes executam a lógica real de jogo em um ambiente DOM/áudio/Canvas substituído somente nas fronteiras externas. O acesso de inspeção é injetado na cópia usada pelos testes, sem API de teste no produto.
- Geração de anexos, chaves, altar e saída exercitada nos três tamanhos, nas oito fases e com duas sementes: **48 combinações**. Chaves opcionais e altar permanecem acessíveis com todas as portas fechadas; bosses aparecem nos marcos corretos.
- Casos de integração verificam recompensa única, morte visual sem combate, coleção após morte/nova campanha, checkpoint de pontuação/armas, tiros hostis de 20–24 células/s bloqueados por paredes, fúria de boss, reforços válidos com limite160 e recompensa mínima épica do boss final.
- Testes de Canvas exercitam armas e recarga, distinção de silhuetas, equipamento, restos animados, antecipação em leque, origem de brasas, alinhamento do altar e reduzir movimento.
- Testes de progressão cobrem probabilidades 60/27/10/3, mínimos de raridade, duplicatas, itens equipáveis, bônus limitados, persistência independente, armazenamento indisponível/corrompido e sequência de pontos com expiração.
- A revisão independente reproduziu um ritual travado por inimigos em caminhos de 68 células, perda de foco ao equipar e pontuação após morte. As regressões agora exercitam 30 segundos de perseguição real, foco após equipar/retirar, limite de 12 partículas em reduzir movimento e o quadro real de dano letal sem recompensas posteriores. Reforços usam caminhos frescos de 4–10 células.
- Servidor local respondeu HTTP200 para HTML, CSS, `game.js`, `renderer.js`, `actor-sprites.js` e `progression.js`; sintaxe dos módulos de execução conferida com `node --check`.

Prévia estática dos sprites reais: [previa-combate.png](previa-combate.png). A prancha é gerada a partir dos comandos Canvas efetivamente emitidos pelos sprites e rasterizada fora do navegador; permite conferir as formas, sem reproduzir a iluminação completa do jogo.

**Limite desta sessão:** o inventário de navegadores está vazio e o navegador integrado está indisponível. Portanto, a composição final da interface em desktop/celular, animações em tempo real e desempenho durante combate denso ainda precisam de conferência em navegador. Nenhum resultado antigo de FPS é apresentado como validação desta expansão.

Resultados da revisão e execução ficam em `docs/superpowers/plans/2026-10-23-expansao-progress.md` e nos relatórios ao lado dele. O comando de verificação continua sendo `npm test`.

## Registros anteriores à expansão

## Resultado

Implementação local verificada em Chrome headless, HTML/CSS/JavaScript sem bibliotecas de execução. O projeto roda com `npm start` em `http://localhost:8080`. Nenhuma publicação externa foi feita.

O original está preservado em `../LumaMaze---Setec-original-20261023.tar.gz`. A cópia original usada nas comparações recebeu somente correção dos caminhos quebrados de módulos e da logo; nenhum ajuste de desempenho foi feito nela.

## Renderização

Mesma máquina e Chrome, resolução CSS 1440×900, DPR 1, qualidade Alta, câmera na capela, mapas idênticos gerados com semente 30419. Uma execução por vez. Cada amostra tem 110 quadros, descartando os primeiros 15 para aquecer os caches. A duração mede a chamada JavaScript do renderizador, sem confundir esse valor com FPS ou tempo total da GPU.

| Cenário | Mediana original | Mediana atual | P95 original | P95 atual |
| --- | ---: | ---: | ---: | ---: |
| Cripta / fase 3, sem projéteis | 12,0 ms | 3,2 ms | 15,0 ms | 4,5 ms |
| Cripta / fase 3, 24 projéteis | 13,9 ms | 3,8 ms | 16,2 ms | 5,0 ms |
| Abismo / fase 8, sem projéteis | 13,0 ms | 3,4 ms | 18,5 ms | 4,4 ms |
| Abismo / fase 8, 24 projéteis | 14,1 ms | 4,4 ms | 17,3 ms | 5,8 ms |

Redução de aproximadamente 69–74% na duração mediana de renderização. O cache de terreno tem limite de 32 MiB; as duas amostras usaram cerca de 12,7 e 7,6 MiB. Luzes móveis e fixas são limitadas, assim como partículas, projéteis, textos de combate e inimigos.

Dados completos: [original](benchmark-original.json) e [atual](benchmark-atual.json).

## Partida completa: amostra de FPS

Chrome headless em 1440×900, DPR 1, qualidade Alta, personagem parado na área inicial da primeira Cripta. Aquecimento de 2,2 segundos e medição de `requestAnimationFrame` por 5 segundos. O gerador original foi injetado apenas no teste para ambos receberem o mesmo mapa com semente 9126; a versão atual mantém a quantidade maior de inimigos e sua IA nova.

- Original: **33,7 FPS**; mediana entre quadros 33,3 ms.
- Atual: **59,8 FPS**; mediana entre quadros 16,7 ms.

Esse resultado local cobre esta cena e este equipamento; resolução, combate, navegador e hardware mudam os valores. Não é uma garantia de 60 FPS em todos os cenários. Registro: [game-fps.json](game-fps.json).

## Funcionalidade

`npm test`: **17 testes aprovados**, incluindo geração reproduzível, 72 combinações de tamanho/fase/semente, conectividade de todos os pisos e regiões, saída alcançável, portas fechadas e abertas, campo de distância compartilhado, recarga ao trocar de arma, arqueiro com parede, investida bloqueada, ataque em leque com aviso, golpe corpo a corpo bloqueado por parede e limites de encontros.

Verificação real do navegador: abertura animada, teclado e foco, movimentação, pausa, Tab/Shift+Tab nos menus, configurações e persistência, indicador opcional de FPS, mapa, coleta de arma, disparo, recarga, brasa, chave/guardião nas três escalas (fases 1, 3 e 8), avanço por Enter preservando checkpoint, morte/repetição, recarregar página e continuar campanha. Console sem erros; todos os recursos locais responderam normalmente.

Telas verificadas: desktop 1440×900, celular 390×844 em DPR 2 e paisagem 844×390. Botão inicial cabe na tela em paisagem; configurações rolam para manter o controle focado visível. Preferência do sistema por movimento reduzido foi verificada. A abertura suspende o Canvas ao sair dela; a renderização do jogo fica suspensa enquanto a abertura está visível.

O teste do navegador usa acesso temporário ao estado por interceptação da resposta HTTP; esse acesso não existe em `game.js` publicado. Registro: [browser-checks.json](browser-checks.json).

## Reproduzir

Os testes Node não precisam de instalação de dependências:

```bash
npm test
npm start
```

Os utilitários opcionais `tools/browser-smoke.mjs` e `tools/benchmark.mjs` usam Puppeteer exclusivamente como ferramenta de verificação. Eles não são carregados pela página e não são necessários para jogar. Com Puppeteer disponível no ambiente, configure `CHROME_BIN` se necessário e execute:

```bash
node tools/browser-smoke.mjs
node tools/benchmark.mjs 8080 atual
```

`PUPPETEER_MODULE` pode apontar para uma instalação de ferramentas externa ao projeto. Para comparar dois renderizadores com os mesmos mapas, passe o mesmo diretório de gerador como quarto argumento, por exemplo `node tools/benchmark.mjs 8081 original /caminho/original`, e depois `node tools/benchmark.mjs 8080 atual /caminho/original`. Execute um de cada vez.

## Revisão

Revisão independente do cenário/IA concluída sem achados pendentes. Na revisão de integração, foram corrigidos foco dos menus, Tab em diálogos, atalhos sobre botões, Enter após vitória, repetição preservando save e rolagem por teclado em telas curtas.

## Prévia

![Nova abertura](previa-abertura.png)
