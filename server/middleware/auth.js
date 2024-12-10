const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

const setUserData = async (req, res, next) => {
    if (req.session.userId) {
        const db = require('../database/db');
        try {
            const result = await db.query(
                'SELECT id, username FROM users WHERE id = $1',
                [req.session.userId]
            );
            res.locals.user = result.rows[0];
        } catch (err) {
            console.error('Error fetching user data:', err);
        }
    }
    next();
};

module.exports = { requireAuth, setUserData };
