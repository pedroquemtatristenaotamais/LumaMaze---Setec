# ÚLTIMA CHAMA — O LABIRINTO MACABRO

Jogo de exploração e combate em HTML, CSS e JavaScript modular, sem bibliotecas ou serviços externos durante a partida.

## Jogar localmente

Na pasta do projeto, execute:

```bash
npm start
```

Abra **http://localhost:8080**. O servidor local usa apenas os módulos nativos do Node, sem `npm install`. Também funciona com a extensão Live Server do VS Code ou qualquer servidor estático. Não abra pelo protocolo `file://`, pois os módulos JavaScript precisam de HTTP.

## Controles

| Ação | Controle |
| --- | --- |
| Movimentar | WASD ou setas |
| Mirar e atirar | Mouse + botão esquerdo; F atira na direção atual |
| Trocar arma | 1 / 2 / 3, depois de encontrar a arma |
| Recarregar | R |
| Abrir passagem secreta / baú | E |
| Mapa | M |
| Configurações | O |
| Pausar / continuar | Espaço ou Esc |

No celular há controles de movimento e disparo. O jogo foi pensado principalmente para teclado e mouse.

## Exploração

Os três tamanhos — Catacumbas, Cripta e Abismo — usam geração procedural e crescem ao longo das oito fases. Os mapas contêm regiões inundadas, capelas e jardins de fungos, passagens secretas, armas e recursos. Encontre a chave para sair. Nas fases 3, 6 e 8, um guardião carrega a chave. O progresso é salvo ao concluir uma fase; use “Continuar campanha” na abertura.

A abertura usa fogo procedural, tochas e brasas em Canvas, sem vídeo. A iluminação do jogo, a animação de água e fungos e os efeitos de combate também são feitos em JavaScript e Canvas 2D.

## Visual e desempenho

Abra os ajustes com **O**:

- **Automática:** ajusta a carga visual conforme o custo da renderização.
- **Alta:** mais luzes e detalhes animados.
- **Leve:** menos luzes, partículas e resolução, mantendo a lógica da partida.
- **Brilho:** ajusta a visibilidade das ruínas.
- **Reduzir movimento:** reduz animações; a preferência do sistema é respeitada na primeira execução.
- **Mostrar FPS:** exibe medição opcional durante a partida.

O desenho estático do labirinto é guardado em blocos limitados em memória. As luzes fixas reutilizam seus cálculos de visibilidade e os inimigos compartilham o cálculo de perseguição. Isso permite mais conteúdo sem recalcular o mesmo cenário e caminho a cada quadro. Ao esconder a abertura, seus efeitos param; a partida pausa ao sair da aba.

FPS depende do navegador, da resolução e do equipamento. Os resultados medidos e o método de comparação ficam em `docs/VERIFICACAO.md`.

## Arquivos

- `index.html`, `style.css`: telas, HUD, controles e ajustes.
- `title-scene.js`: portal, tochas, fogo e brasas da abertura.
- `game.js`: ciclo da partida, combate, coleta, inimigos e progressão.
- `renderer.js`: câmera, cenário em cache, materiais, sombras e efeitos.
- `maze-generator.js`, `pathfinding.js`: geração e navegação.
- `config.js`, `enemy-types.js`: tamanhos, armas e classes de inimigos.
- `audio.js`, `hud.js`, `save-system.js`: áudio procedural, indicadores e persistência local.
- `colegio-logo.png`: identidade do Colégio Estadual Barbosa Ferraz.
- `tools/serve.js`: servidor local de desenvolvimento; não é necessário na hospedagem.

## Verificar

```bash
npm test
```

Os testes usam o executor nativo do Node. A hospedagem continua estática: publique os arquivos do projeto; não há build. Consulte `DEPLOY-VERCEL.txt` se usar Vercel.

Créditos: um jogo de **Pedro**, **2 DS**, Colégio Estadual Barbosa Ferraz.
