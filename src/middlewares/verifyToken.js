const jwt = require('jsonwebtoken');
const userDB = require('../database/models/user');


function verifyToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token manquant' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
        return res.status(401).json({
            code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
            message: err.name === 'TokenExpiredError' ? 'Le token est expiré' : 'Token invalide'
        });
    }

    userDB.findById(decoded.id).select('email role').then(user => {
        if (!user) {
            return res.status(401).json({ code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' });
        }

        req.user = {
            id: user._id,
            email: user.email,
            role: user.role
        };

        next();
    }).catch(err => {
        console.error('Erreur lors de la récupération de l’utilisateur :', err);
        return res.status(500).json({ code: 'SERVER_ERROR' });
    });
}

module.exports = verifyToken;