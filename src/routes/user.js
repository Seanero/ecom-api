const express = require('express');
const Joi = require("joi");
const bcrypt = require("bcrypt");
const {sign, verify} = require("jsonwebtoken");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");

const userDB = require("../database/models/user")

const invoiceAddressSchema = Joi.object({
    line1: Joi.string()
        .required(),
    line2: Joi.string()
        .optional()
        .allow(''),
    postalCode: Joi.string()
        .required(),
    city: Joi.string()
        .required(),
    stateOrDepartment: Joi.string()
        .optional(),
    country: Joi.string()
        .required()
});

const userSchema = Joi.object({
    firstname: Joi.string()
        .min(3)
        .max(20)
        .required(),
    lastname: Joi.string()
        .min(3)
        .max(30)
        .required(),
    email: Joi.string()
        .min(3)
        .max(100)
        .lowercase()
        .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
        .required(),
    password: Joi.string()
        .min(3)
        .max(200)
        .required(),
    invoiceAddress: invoiceAddressSchema.required()
});

router.get('/', (req, res) => {
    res.json({response: "API is running"});
})

router.get('/me', verifyToken, async (req, res) => {

    if(!req.cookies.token) return res.status(401).json({code: "Invalid Token"});

    const tokenContent = verify(req.cookies.token, process.env.SECRET_KEY);

    userDB.findOne({email: tokenContent.email})
        .then(user => {
            res.status(200).json({response: "OK", user});
        })
        .catch(err => res.status(401).json({code: "TOKEN_INVALID"}));
})

router.post('/edit', verifyToken, async (req, res) => {
    const {user, edit} = req.body;

    if (!user || !edit) {
        return res.status(400).json({code: 'INVALID_BODY', message: 'user ou edit manquant'});
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.email === user;

    if (!isAdmin && !isSelf) {
        return res.status(403).json({code: 'FORBIDDEN', message: 'Tu ne peux modifier que ton propre compte'});
    }

    if(!isAdmin && edit.role){
        return res.status(403).json({code: 'FORBIDDEN', message: 'Tu ne peux modifier ton propre rôle'});
    }

    try {
        const updatedUser = await userDB.findOneAndUpdate(
            { _id: user },
            { $set: edit },
            { new: true }
        );


        if (!updatedUser) {
            return res.status(404).json({ code: 'USER_NOT_FOUND' });
        }

        if (isSelf && edit.email && edit.email !== req.user.email) {
            res.clearCookie("token", { httpOnly: true, secure: false, sameSite: 'strict' });

            const payload = {
                id: updatedUser._id,
                email: updatedUser.email,
            };

            const newToken = sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });

            res.cookie('token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 3600000
            });
        }

        res.status(200).json({
            code: 'USER_UPDATED',
            data: {
                id: updatedUser._id,
                email: updatedUser.email,
                ...edit
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 'SERVER_ERROR' });
    }

})

router.post('/changePassword', verifyToken, async (req, res) => {
    const { currentPassword, newPassword, userId } = req.body;

    if (!currentPassword || !newPassword || !userId) {
        return res.status(400).json({
            code: 'INVALID_BODY',
            message: 'Le mot de passe actuel, le nouveau mot de passe et l\'ID utilisateur sont requis'
        });
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id.toString() === userId;

    if (!isAdmin && !isSelf) {
        return res.status(403).json({
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez modifier que votre propre mot de passe'
        });
    }

    try {
        // Récupérer l'utilisateur
        const user = await userDB.findById(userId);

        if (!user) {
            return res.status(404).json({ code: 'USER_NOT_FOUND' });
        }

        // Pour les utilisateurs non-admin, vérifier le mot de passe actuel
        if (!isAdmin || isSelf && isAdmin) {
            // Utiliser bcrypt.compare pour comparer le mot de passe en clair avec le hash stocké
            const isMatch = await bcrypt.compare(currentPassword, user.password)

            if (!isMatch) {
                return res.status(401).json({
                    code: 'INCORRECT_PASSWORD',
                    message: 'Le mot de passe actuel est incorrect'
                });
            }
        }

        // Hasher le nouveau mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Mettre à jour le mot de passe
        const updatedUser = await userDB.findByIdAndUpdate(
            userId,
            { $set: { password: hashedPassword } },
            { new: true }
        );

        res.status(200).json({
            code: 'PASSWORD_UPDATED',
            message: 'Mot de passe mis à jour avec succès'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            code: 'SERVER_ERROR',
            message: 'Une erreur est survenue lors de la modification du mot de passe'
        });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        // Rechercher l'utilisateur par email uniquement (pas par mot de passe)
        const user = await userDB.findOne({ email });

        // Si aucun utilisateur n'est trouvé avec cet email
        if (!user) {
            return res.status(404).json({ code: "LOGIN_INCORRECT" });
        }

        // Comparer le mot de passe fourni avec le mot de passe haché stocké
        const isMatch = await bcrypt.compare(password, user.password);

        // Si le mot de passe ne correspond pas
        if (!isMatch) {
            return res.status(404).json({ code: "LOGIN_INCORRECT" });
        }

        // Créer le payload pour le token JWT
        const userPayload = {
            id: user._id,
            email: user.email,
        };

        // Générer le token JWT
        const token = sign(userPayload, process.env.SECRET_KEY, { expiresIn: '1h' });

        // Définir le cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 3600000
        });

        // Mettre à jour la date de dernière connexion
        user.lastLogin = new Date();
        await user.save();

        // Répondre avec succès
        res.status(200).send({
            code: "LOGIN-SUCCESS",
            user: email
        });

    } catch (error) {
        console.error("Erreur de connexion:", error);
        res.status(500).json({
            code: "SERVER_ERROR",
            message: "Une erreur est survenue lors de la connexion"
        });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { error, value } = userSchema.validate(req.body);

        if(error) {
            return res.status(400).json({
                code: "VALIDATION_ERROR",
                message: error.details[0].message
            });
        }

        // Hacher le mot de passe avant l'enregistrement
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(value.password, salt);

        // Remplacer le mot de passe en clair par le mot de passe haché
        value.password = hashedPassword;

        // Créer et enregistrer le nouvel utilisateur
        const newUser = new userDB(value);
        await newUser.save();

        // Réponse réussie
        res.status(201).json({
            code: "USER_CREATED",
            message: "Utilisateur créé avec succès"
        });
    } catch (err) {
        // Gérer les erreurs spécifiques
        if (err.code === 11000) {
            // Erreur de duplication (généralement pour un email déjà utilisé)
            return res.status(409).json({
                code: "DUPLICATE_EMAIL",
                message: "Cet email est déjà utilisé"
            });
        }

        // Autres erreurs
        console.error("Erreur lors de l'enregistrement :", err);
        res.status(500).json({
            code: "SERVER_ERROR",
            message: "Une erreur est survenue lors de l'enregistrement"
        });
    }
});

router.get("/logout", verifyToken, (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: false, sameSite: 'strict' });
    res.status(200).json({ code: "LOGOUT_SUCCESS" });
});

module.exports = router;