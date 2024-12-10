const express = require('express');
const router = express.Router();

// Almacenamiento en memoria de los juegos activos
const games = {};

// Limpiar juegos viejos periódicamente (más de 24 horas)
setInterval(() => {
    const now = Date.now();
    Object.keys(games).forEach(gameCode => {
        if (now - games[gameCode].created > 24 * 60 * 60 * 1000) {
            delete games[gameCode];
        }
    });
}, 60 * 60 * 1000); // Cada hora

// Crear una nueva partida
router.post('/create', (req, res) => {
    const { gameCode, timeControl } = req.body;
    
    if (!gameCode) {
        return res.status(400).json({ 
            success: false, 
            message: 'Código de juego requerido' 
        });
    }

    // Verificar si el código ya está en uso
    if (games[gameCode]) {
        return res.status(400).json({ 
            success: false, 
            message: 'Este código ya está en uso' 
        });
    }
    
    // Crear nuevo juego
    games[gameCode] = {
        timeControl: parseInt(timeControl) || 10,
        whitePlayer: req.session.userId,
        created: Date.now(),
        status: 'waiting' // waiting, ready, playing, finished
    };
    
    res.json({ 
        success: true,
        message: 'Partida creada exitosamente',
        gameCode 
    });
});

// Unirse a una partida existente
router.post('/join', (req, res) => {
    const { gameCode } = req.body;
    
    if (!gameCode) {
        return res.status(400).json({ 
            success: false, 
            message: 'Código de juego requerido' 
        });
    }
    
    const game = games[gameCode];
    
    if (!game) {
        return res.status(404).json({ 
            success: false, 
            message: 'Partida no encontrada' 
        });
    }

    // Verificar si el jugador ya está en la partida
    if (game.whitePlayer === req.session.userId) {
        return res.json({ 
            success: true,
            message: 'Ya estás en esta partida como blancas' 
        });
    }
    
    if (game.blackPlayer === req.session.userId) {
        return res.json({ 
            success: true,
            message: 'Ya estás en esta partida como negras' 
        });
    }
    
    if (game.blackPlayer) {
        return res.status(400).json({ 
            success: false, 
            message: 'La partida está llena' 
        });
    }
    
    // Asignar jugador negro
    game.blackPlayer = req.session.userId;
    game.status = 'ready';
    
    res.json({ 
        success: true,
        message: 'Te has unido a la partida exitosamente' 
    });
});

// Vista del tablero
router.get('/:gameCode', (req, res) => {
    const { gameCode } = req.params;
    const game = games[gameCode];
    
    if (!game) {
        return res.redirect('/?error=gameNotFound');
    }
    
    const isWhitePlayer = game.whitePlayer === req.session.userId;
    const isBlackPlayer = game.blackPlayer === req.session.userId;
    
    if (!isWhitePlayer && !isBlackPlayer) {
        return res.redirect('/?error=notPlayer');
    }
    
    res.render('game', {
        color: isWhitePlayer ? 'white' : 'black',
        gameCode,
        timeControl: game.timeControl,
        username: res.locals.user.username
    });
});

module.exports = router;