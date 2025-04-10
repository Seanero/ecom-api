const express = require('express');
const Joi = require("joi");
const bcrypt = require("bcrypt");
const {sign, verify} = require("jsonwebtoken");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

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
            res.clearCookie("token", { httpOnly: true, secure: false, sameSite: 'lax' });

            const payload = {
                id: updatedUser._id,
                email: updatedUser.email,
            };

            const newToken = sign(payload, process.env.SECRET_KEY, { expiresIn: '1h' });

            res.cookie('token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
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

    if (!newPassword || !userId) {
        return res.status(400).json({
            code: 'INVALID_BODY',
            message: 'Le nouveau mot de passe et l\'ID utilisateur sont requis'
        });
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id.toString() === userId;

    // Seuls les admins ou les utilisateurs eux-mêmes peuvent changer un mot de passe
    if (!isAdmin && !isSelf) {
        return res.status(403).json({
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez modifier que votre propre mot de passe'
        });
    }

    try {
        const user = await userDB.findById(userId);

        if (!user) {
            return res.status(404).json({ code: 'USER_NOT_FOUND' });
        }

        // Si ce n’est pas un admin, ou si c’est un admin qui modifie son propre mot de passe → vérifier l’ancien mot de passe
        if (!isAdmin || (isAdmin && isSelf)) {
            if (!currentPassword) {
                return res.status(400).json({
                    code: 'CURRENT_PASSWORD_REQUIRED',
                    message: 'Le mot de passe actuel est requis'
                });
            }

            const isMatch = await bcrypt.compare(currentPassword, user.password);

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
        await userDB.findByIdAndUpdate(
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

router.post("/loginApp", async (req, res) => {
    const { email, password } = req.body;

    console.log(email, password);

    try {
        const user = await userDB.findOne({ email });

        if (!user) {
            return res.status(404).json({ code: "LOGIN_INCORRECT" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(404).json({ code: "LOGIN_INCORRECT" });
        }

        const userPayload = {
            id: user._id,
            email: user.email,
        };

        // Générer le token JWT
        const token = sign(userPayload, process.env.SECRET_KEY, { expiresIn: '1h' });

        // Mettre à jour la date de dernière connexion
        user.lastLogin = new Date();
        await user.save();

        // Répondre avec succès + token
        res.status(200).json({
            code: "LOGIN_SUCCESS",
            token,
            user: {
                email: user.email,
                lastLogin: user.lastLogin
            }
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
    res.clearCookie("token", { httpOnly: true, secure: false, sameSite: 'lax' });
    res.status(200).json({ code: "LOGOUT_SUCCESS" });
});

router.get('/getAll', verifyToken, verifyAdmin , async (req, res) => {
    try {
        // Récupérer tous les utilisateurs, sans inclure leur mot de passe
        const users = await userDB.find({}, { password: 0 });

        return res.status(200).json({
            code: "SUCCESS",
            users
        });
    } catch (err) {
        console.error("Erreur lors de la récupération des utilisateurs:", err);
        return res.status(500).json({
            code: "SERVER_ERROR",
            message: "Une erreur est survenue lors de la récupération des utilisateurs"
        });
    }
});

router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
    const userId = req.params.id;

    // Vérifier si l'utilisateur essaie de se supprimer lui-même
    if (req.user.id.toString() === userId) {
        return res.status(403).json({
            code: 'FORBIDDEN',
            message: 'Vous ne pouvez pas supprimer votre propre compte administrateur'
        });
    }

    try {
        const userToDelete = await userDB.findById(userId);

        if (!userToDelete) {
            return res.status(404).json({
                code: 'USER_NOT_FOUND',
                message: 'Utilisateur non trouvé'
            });
        }

        // Supprimer l'utilisateur
        await userDB.findByIdAndDelete(userId);

        return res.status(200).json({
            code: 'USER_DELETED',
            message: 'Utilisateur supprimé avec succès'
        });
    } catch (err) {
        console.error("Erreur lors de la suppression de l'utilisateur:", err);
        return res.status(500).json({
            code: 'SERVER_ERROR',
            message: "Une erreur est survenue lors de la suppression de l'utilisateur"
        });
    }
});

module.exports = router;