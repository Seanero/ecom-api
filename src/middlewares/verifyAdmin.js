function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Accès réservé aux administrateurs' });
    }

    next();
}

module.exports = requireAdmin;