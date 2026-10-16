ÚLTIMA CHAMA — O LABIRINTO MACABRO

Jogo 2D de terror em pixel art, feito em HTML, CSS e JavaScript modular.

COMO EXECUTAR
1. Extraia a pasta do ZIP.
2. Abra a pasta no Visual Studio Code e execute index.html com a extensão Live Server, ou utilize outro servidor HTTP local.
3. Abra o endereço local no Chrome ou Firefox. Como o projeto usa ES Modules, não abra o HTML diretamente pelo caminho file://.

CONTROLES
WASD ou setas: movimentar-se
Mouse + clique esquerdo: mirar e atirar
1, 2, 3: selecionar pistola, shotgun ou AK-47 (depois de coletadas)
R: recarregar
E: interagir com painéis secretos e baús
M: abrir/fechar o mapa opcional
O: abrir configurações de som, volume, brilho e efeitos reduzidos
Espaço ou Esc: pausar (Esc fecha as configurações quando abertas)

COMBATE E EXPLORAÇÃO
- O jogador começa apenas com a tocha; as armas são encontradas no mapa.
- Pistola, shotgun e AK-47 usam carregador e munição reserva. Os tiros podem ricochetear na pedra, com limite de alcance e de rebotes.
- Inimigos diferentes têm padrões próprios: esqueletos comuns, guerreiros resistentes, arqueiros que disparam à distância e esqueletos velozes. Nas fases 3, 6 e 8 há um Guardião Amaldiçoado, com mais vida, ataque especial e chave para a saída.
- Kits médicos e caixas de munição são coletáveis. Inimigos podem deixar recursos ao morrer.
- Encontre a chave antes de tentar abrir a saída. Nas fases com guardião, derrote-o e recolha a chave que ele deixa cair.
- Procure painéis de pedra rachados e pressione E perto deles para descobrir passagens secretas. Baús escondidos também são abertos com E.
- A campanha tem oito fases; o tamanho, a quantidade de inimigos e a dificuldade aumentam progressivamente. O progresso é salvo automaticamente ao concluir uma fase e pode ser retomado na tela de título.
- O mapa opcional é revelado com M. Passagens secretas e seus tesouros só são mostrados quando descobertos.

AMBIENTES E ATMOSFERA
- Três regiões especiais são geradas nos labirintos: cripta inundada, capela abandonada e bosque tomado por fungos.
- Pedra cinza tipo cobblestone, musgo, raízes, água com ondulações, entulho, ossos, fungos bioluminescentes, poeira no ar e emblemas do Barbosa Ferraz com a inscrição 2 DS.
- A tocha e os projéteis emitem iluminação dinâmica que respeita as paredes. O áudio ambiente aumenta de intensidade quando inimigos estão próximos.
- A tela inicial mostra o nome Última Chama, a logo escolar e o crédito “Um jogo de Pedro”.

CONFIGURAÇÕES
Pressione O durante o jogo para alternar sons, ajustar volume, brilho e reduzir efeitos animados. As configurações são salvas localmente no navegador.

ESTRUTURA DO CÓDIGO
- game.js: ciclo da partida, movimentação, colisões, inimigos, combate e progressão
- js/config.js: balanceamento, tamanhos de mapas e armas
- js/maze-generator.js: geração procedural, corredores e três regiões temáticas
- js/enemy-types.js: atributos e escolha das classes de inimigos
- js/renderer.js: renderização pixel art, câmera, sombras, luzes, efeitos e mapa
- js/audio.js: efeitos e ambiente via Web Audio
- js/hud.js: barra de vida e munição
- js/save-system.js: progresso da campanha e configurações locais
- assets/colegio-logo.png: emblema escolar usado na tela de título e nas placas do cenário

O jogo utiliza apenas recursos locais, sem bibliotecas externas obrigatórias.

HOSPEDAGEM NO VERCEL
Veja DEPLOY-VERCEL.txt para instruções de publicação. O projeto é estático e não exige etapa de build; configure Framework Preset como Other e Output Directory como . ao importar pelo painel. Há um vercel.json incluído.
