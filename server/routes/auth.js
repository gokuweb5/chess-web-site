const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');

// Register new user
router.post('/register', async (req, res) => {
    console.log('Registro recibido:', req.body);
    
    try {
        const { username, email, password } = req.body;
        
        // Validaciones básicas
        if (!username || !email || !password) {
            console.log('Error: Campos faltantes');
            return res.status(400).json({ 
                success: false, 
                message: 'Todos los campos son requeridos' 
            });
        }

        // Verificar si el usuario ya existe
        console.log('Verificando usuario existente...');
        const userExists = await db.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            console.log('Error: Usuario ya existe');
            return res.status(400).json({ 
                success: false, 
                message: 'El usuario o email ya está registrado' 
            });
        }

        // Hash password
        console.log('Generando hash de contraseña...');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Insert new user
        console.log('Insertando nuevo usuario...');
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, passwordHash]
        );
        
        console.log('Usuario registrado exitosamente:', result.rows[0]);
        res.json({ 
            success: true, 
            user: result.rows[0],
            message: 'Usuario registrado exitosamente' 
        });
    } catch (err) {
        console.error('Error detallado en registro:', {
            error: err.message,
            code: err.code,
            detail: err.detail,
            table: err.table,
            constraint: err.constraint
        });
        
        // Manejar errores específicos
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({
                success: false,
                message: 'El usuario o email ya está registrado'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error al registrar usuario. Por favor intente nuevamente.' 
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    console.log('Intento de login:', { username: req.body.username });
    
    try {
        const { username, password } = req.body;
        
        // Validaciones básicas
        if (!username || !password) {
            console.log('Error: Campos faltantes en login');
            return res.status(400).json({ 
                success: false, 
                message: 'Usuario y contraseña son requeridos' 
            });
        }
        
        // Find user
        console.log('Buscando usuario en la base de datos...');
        const result = await db.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        
        const user = result.rows[0];
        
        if (!user) {
            console.log('Error: Usuario no encontrado');
            return res.status(401).json({ 
                success: false, 
                message: 'Usuario o contraseña incorrectos' 
            });
        }
        
        // Verify password
        console.log('Verificando contraseña...');
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            console.log('Error: Contraseña incorrecta');
            return res.status(401).json({ 
                success: false, 
                message: 'Usuario o contraseña incorrectos' 
            });
        }
        
        // Update last login
        console.log('Actualizando último login...');
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        // Set session
        req.session.userId = user.id;
        
        console.log('Login exitoso:', { username: user.username, id: user.id });
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            message: 'Inicio de sesión exitoso'
        });
    } catch (err) {
        console.error('Error detallado en login:', {
            error: err.message,
            code: err.code,
            detail: err.detail,
            table: err.table,
            constraint: err.constraint
        });
        res.status(500).json({ 
            success: false, 
            message: 'Error al iniciar sesión. Por favor intente nuevamente.' 
        });
    }
});

// Logout user
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error en logout:', err); // Log para debugging
            return res.status(500).json({ 
                success: false, 
                message: 'Error al cerrar sesión' 
            });
        }
        res.json({ 
            success: true,
            message: 'Sesión cerrada exitosamente' 
        });
    });
});

// Get current user
router.get('/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            message: 'No autenticado' 
        });
    }
    
    try {
        const result = await db.query(
            'SELECT id, username, email FROM users WHERE id = $1',
            [req.session.userId]
        );
        
        if (!result.rows[0]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }
        
        res.json({ 
            success: true, 
            user: result.rows[0] 
        });
    } catch (err) {
        console.error('Error al obtener usuario:', err); // Log para debugging
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener información del usuario' 
        });
    }
});

module.exports = router;
