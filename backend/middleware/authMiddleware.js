const jwt = require('jsonwebtoken');

const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided, authorization denied' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;

            if (roles.length && !roles.includes(req.user.role)) {
                return res.status(403).json({ message: `Access denied: insufficient permissions. Expected one of [${roles.join(',')}], but got '${req.user.role}'. Please log out and log back in.` });
            }

            next();
        } catch (error) {
            res.status(401).json({ message: 'Token is not valid' });
        }
    };
};

module.exports = authMiddleware;
