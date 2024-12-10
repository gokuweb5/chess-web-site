const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const http = require('http'),
      express = require('express'),
      session = require('express-session'),
      pgSession = require('connect-pg-simple')(session),
      socket = require('socket.io');

const config = require('../config');
const { pool } = require('./database/db');
const { requireAuth, setUserData } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const myIo = require('./sockets/io'),
      routes = require('./routes/routes');

const app = express(),
      server = http.Server(app),
      io = socket(server);

// Middleware para parsear JSON y form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión
app.use(session({
    store: new pgSession({
        pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 días
}));

// Servir archivos estáticos
app.use('/public', express.static(path.join(__dirname, '..', 'front', 'public')));
app.use(express.static(path.join(__dirname, '..', 'front')));
app.use(setUserData);

// Configuración de vistas
app.set('views', path.join(__dirname, '..', 'front', 'views'));
app.set('view engine', 'html');
app.engine('html', require('express-handlebars').engine({
    extname: '.html',
    defaultLayout: false,
    helpers: {
        json: function(context) {
            return JSON.stringify(context);
        }
    }
}));

// Rutas de autenticación
app.use('/auth', authRoutes);

// Rutas públicas
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login');
});

app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('register');
});

// Ruta principal protegida
app.get('/', requireAuth, (req, res) => {
    res.render('index', { user: res.locals.user });
});

// Rutas del juego
app.use('/game', requireAuth, routes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

// Socket.io
myIo(io);

const port = process.env.PORT || 3037;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});