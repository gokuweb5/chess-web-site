const games = {};

module.exports = app => {
    app.get('/', (req, res) => {
        res.render('index');
    });

    app.get('/create', (req, res) => {
        const timeControl = req.query.timeControl || 10;
        const username = req.query.username;
        const gameCode = req.query.gameCode;
        
        if (!username) {
            return res.redirect('/?error=noUsername');
        }

        if (!gameCode) {
            return res.redirect('/?error=noCode');
        }

        // Verificar si el código ya está en uso
        if (games[gameCode]) {
            return res.redirect('/?error=codeInUse');
        }
        
        // Crear nuevo juego con el código proporcionado
        games[gameCode] = {
            timeControl: parseInt(timeControl),
            created: true,
            whitePlayer: username
        };
        
        res.render('game', {
            color: 'white',
            gameCode: gameCode,
            timeControl: timeControl,
            username: username
        });
    });

    app.get('/black', (req, res) => {
        const gameCode = req.query.code;
        const username = req.query.username;
        
        if (!username) {
            return res.redirect('/?error=noUsername');
        }
        
        if (!gameCode) {
            return res.redirect('/?error=noCode');
        }

        if (!games[gameCode] || !games[gameCode].created) {
            return res.redirect('/?error=invalidCode');
        }

        // Store black player's username
        games[gameCode].blackPlayer = username;

        res.render('game', {
            color: 'black',
            gameCode: gameCode,
            timeControl: games[gameCode].timeControl,
            username: username
        });
    });

    // Export games object to be used in other modules
    global.games = games;
};