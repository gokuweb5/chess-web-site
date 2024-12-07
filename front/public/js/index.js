let gameHasStarted = false;
var board = null;
var game = new Chess();
var $status = $('#status');
var $pgn = $('#pgn');
let gameOver = false;

function initGame() {
    // Initialize the board
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: '/public/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('myBoard', config);

    if (playerColor === 'black') {
        board.flip();
    }

    // Join the game room
    socket.emit('joinGame', {
        code: gameCode,
        color: playerColor,
        timeControl: timeControl,
        username: playerUsername
    });

    console.log('Game initialized:', {
        color: playerColor,
        code: gameCode,
        timeControl: timeControl,
        username: playerUsername
    });
}

// Socket event handlers
socket.on('playersConnected', function(data) {
    console.log('Players connected:', data);
    $('#status').text(`Both players connected (${data.white} vs ${data.black}). Click Ready when you want to start!`);
    $('#readyButton').prop('disabled', false);
});

socket.on('bothPlayersReady', function() {
    console.log('Both players ready, game starting');
    gameHasStarted = true;
    $('#status').text(`Game started! ${playerColor === 'white' ? 'You play white.' : 'You play black.'}`);
    $('#readyButton').text('Game in progress').prop('disabled', true);
    updateStatus();
});

socket.on('move', function(moveData) {
    console.log('Received move:', moveData);
    
    // Si el movimiento viene del otro jugador, aplicarlo
    if (moveData.color !== playerColor) {
        console.log('Applying opponent move');
        let move = game.move({
            from: moveData.from,
            to: moveData.to,
            promotion: moveData.promotion
        });
        
        if (move) {
            board.position(game.fen());
            updateStatus();
        }
    }
});

socket.on('gameOverTime', function(data) {
    gameOver = true;
    $status.html(`Game over - ${data.winnerUsername} wins on time`);
});

socket.on('gameOverDisconnect', function(data) {
    gameOver = true;
    $status.html(`Game over - ${data.username} disconnected`);
});

// Game functions
function onDragStart(source, piece, position, orientation) {
    console.log('Drag start:', { source, piece, position });
    
    // do not pick up pieces if the game is over or not started
    if (game.game_over() || gameOver || !gameHasStarted) {
        console.log('Move rejected: game over or not started');
        return false;
    }

    // only pick up pieces for current player and correct color
    if ((playerColor === 'black' && piece.search(/^w/) !== -1) || 
        (playerColor === 'white' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'w' && piece.search(/^b/) !== -1) || 
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        console.log('Move rejected: wrong color or not player\'s turn');
        return false;
    }

    return true;
}

function onDrop(source, target) {
    console.log('Attempting move:', { from: source, to: target });
    
    // see if the move is legal
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    });

    // illegal move
    if (move === null) {
        console.log('Illegal move');
        return 'snapback';
    }

    // Emitir el movimiento al servidor
    socket.emit('move', {
        from: source,
        to: target,
        promotion: 'q',
        color: playerColor
    });

    updateStatus();
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateStatus() {
    let status = '';

    if (game.game_over()) {
        if (game.in_checkmate()) {
            status = `Game over - ${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`;
            // Emitir evento de jaque mate al servidor
            socket.emit('checkmate', {
                winner: game.turn() === 'w' ? 'black' : 'white'
            });
        } else if (game.in_draw()) {
            status = 'Game over - Draw';
        } else if (game.in_stalemate()) {
            status = 'Game over - Stalemate';
        } else if (game.in_threefold_repetition()) {
            status = 'Game over - Draw by repetition';
        } else if (game.insufficient_material()) {
            status = 'Game over - Draw by insufficient material';
        }
        gameOver = true;
    } else {
        let moveColor = game.turn() === 'w' ? 'White' : 'Black';
        if (game.in_check()) {
            status = `${moveColor} to move (in check)`;
        } else {
            status = `${moveColor} to move`;
        }
    }

    $status.html(status);
    $pgn.html(game.pgn());
}

// Initialize the game when the page loads
$(document).ready(function() {
    initGame();
});

// Chat functionality
function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
        socket.emit('chat', message);
        input.value = '';
    }
}

// Handle enter key in chat input
document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Handle chat messages
socket.on('chat', function(data) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message' + (data.username === playerUsername ? ' own' : '');
    messageDiv.textContent = `${data.username}: ${data.message}`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Timer functionality
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

socket.on('updateTimers', function(data) {
    document.getElementById('whiteTimer').textContent = formatTime(data.whiteTime);
    document.getElementById('blackTimer').textContent = formatTime(data.blackTime);
});

var urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('code')) {
    socket.emit('joinGame', {
        code: urlParams.get('code')
    });
}