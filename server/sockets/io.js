const games = {};
const players = {};

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log('New client connected');

        socket.on('joinGame', (data) => {
            const { code, color, timeControl, username } = data;
            console.log(`Player ${username} joining game ${code} as ${color}`);
            
            if (!games[code]) {
                games[code] = {
                    white: null,
                    black: null,
                    timeControl: timeControl,
                    whiteReady: false,
                    blackReady: false,
                    gameStarted: false,
                    whiteTime: timeControl * 60,
                    blackTime: timeControl * 60,
                    turn: 'white',
                    moves: []
                };
            }

            // Store player info
            players[socket.id] = {
                username: username,
                gameCode: code,
                color: color
            };

            // Join the game room
            socket.join(code);
            
            // Assign player to their color
            if (color === 'white') {
                games[code].white = socket.id;
            } else if (color === 'black') {
                games[code].black = socket.id;
            }

            // Check if both players are connected
            if (games[code].white && games[code].black) {
                console.log(`Both players connected in game ${code}`);
                io.to(code).emit('playersConnected', {
                    white: players[games[code].white].username,
                    black: players[games[code].black].username
                });
            }
        });

        socket.on('playerReady', () => {
            const player = players[socket.id];
            if (!player) return;

            const game = games[player.gameCode];
            if (!game) return;

            console.log(`Player ${player.username} is ready`);

            // Mark player as ready
            if (player.color === 'white') {
                game.whiteReady = true;
            } else if (player.color === 'black') {
                game.blackReady = true;
            }

            // Check if both players are ready
            if (game.whiteReady && game.blackReady && !game.gameStarted) {
                console.log(`Game ${player.gameCode} starting`);
                game.gameStarted = true;
                io.to(player.gameCode).emit('bothPlayersReady');
                
                // Iniciar el temporizador
                game.timer = setInterval(() => {
                    if (game.turn === 'white') {
                        game.whiteTime--;
                    } else {
                        game.blackTime--;
                    }

                    // Emitir actualización de tiempo
                    io.to(player.gameCode).emit('timeUpdate', {
                        white: game.whiteTime,
                        black: game.blackTime
                    });

                    // Verificar si se acabó el tiempo
                    if (game.whiteTime <= 0) {
                        clearInterval(game.timer);
                        io.to(player.gameCode).emit('gameOverTime', {
                            winnerUsername: players[game.black].username
                        });
                    } else if (game.blackTime <= 0) {
                        clearInterval(game.timer);
                        io.to(player.gameCode).emit('gameOverTime', {
                            winnerUsername: players[game.white].username
                        });
                    }
                }, 1000);
            }
        });

        socket.on('move', (data) => {
            const player = players[socket.id];
            if (!player) {
                console.log('Move rejected: Player not found');
                return;
            }

            const game = games[player.gameCode];
            if (!game || !game.gameStarted) {
                console.log('Move rejected: Game not found or not started');
                return;
            }

            // Validar que es el turno del jugador
            if (game.turn !== player.color) {
                console.log('Move rejected: Not player\'s turn');
                return;
            }

            console.log(`Move from ${player.color} in game ${player.gameCode}: ${data.from} to ${data.to}`);

            // Cambiar el turno
            game.turn = game.turn === 'white' ? 'black' : 'white';
            
            // Emitir el movimiento a todos los jugadores en la sala
            io.to(player.gameCode).emit('move', {
                from: data.from,
                to: data.to,
                promotion: data.promotion,
                color: player.color
            });
        });

        socket.on('chat', (message) => {
            const player = players[socket.id];
            if (!player) return;

            console.log(`Chat message from ${player.username}: ${message}`);

            io.to(player.gameCode).emit('chat', {
                username: player.username,
                message: message
            });
        });

        socket.on('disconnect', () => {
            const player = players[socket.id];
            if (player) {
                console.log(`Player ${player.username} disconnected from game ${player.gameCode}`);
                const game = games[player.gameCode];
                if (game) {
                    // Limpiar el temporizador si existe
                    if (game.timer) {
                        clearInterval(game.timer);
                    }
                    io.to(player.gameCode).emit('gameOverDisconnect', {
                        username: player.username
                    });
                }
                delete players[socket.id];
            }
        });

        socket.on('checkmate', (data) => {
            const player = players[socket.id];
            if (!player) return;

            const game = games[player.gameCode];
            if (!game) return;

            // Detener el temporizador
            if (game.timer) {
                clearInterval(game.timer);
            }

            // Emitir el evento de fin de juego a todos los jugadores
            io.to(player.gameCode).emit('gameOver', {
                reason: 'checkmate',
                winner: data.winner,
                winnerUsername: players[data.winner === 'white' ? game.white : game.black].username
            });
        });
    });
};