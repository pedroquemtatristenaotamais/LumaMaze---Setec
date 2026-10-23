# Verificação — 23/10/2026

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
