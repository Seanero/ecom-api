const express = require('express');
const Joi = require("joi");
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

    console.log(req.user);

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

    console.log(req.user)

    if(!isAdmin && edit.role){
        return res.status(403).json({code: 'FORBIDDEN', message: 'Tu ne peux modifier ton propre rôle'});
    }

    try {
        const updatedUser = await userDB.findOneAndUpdate(
            { email: user },
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

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const getUser = await userDB.findOne({ email, password });

    if(!getUser) return res.status(404).json({code: "LOGIN_INCORRECT"});

    const userPayload = {
        id: getUser._id,
        email: getUser.email,
    };

    const token = sign(userPayload, process.env.SECRET_KEY, { expiresIn: '1h' });

    res.cookie("token", token, { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 3600000 });

    getUser.lastLogin = new Date();
    await getUser.save();


    res.status(200).send({code:"LOGIN-SUCCESS", user: email})
})

router.post('/register', async (req, res) => {
    const { error, value } = userSchema.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const newUser = new userDB(value);
    await newUser.save()
        .then(() => {
            res.status(201).json({response: "User created"});
            console.log("Utilisateur enregistré !");
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Erreur :", err);
        });
});

router.get("/logout", verifyToken, (req, res) => {
    res.clearCookie("token", { httpOnly: true, secure: false, sameSite: 'strict' });
    res.status(200).json({ code: "LOGOUT_SUCCESS" });
});

module.exports = router;