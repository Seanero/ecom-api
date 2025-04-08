const express = require('express');
const Joi = require('joi');
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

const contactDB = require('../database/models/contact');

// Schéma de validation pour un formulaire de contact
const contactSchema = Joi.object({
    fullname: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^((\+33|0)[1-9])(?:[\s.-]?\d{2}){4}$/).required(),
    subject: Joi.string().min(3).max(255).required(),
    message: Joi.string().min(3).max(2000).required()
});

// Schéma pour suppression
const deleteSchema = Joi.object({
    id: Joi.string().required()
});

// Route de test
router.get('/', (req, res) => {
    res.json({ response: "Contact API is running" });
});

// Récupérer tous les formulaires (admin uniquement)
router.get('/getAll', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const contacts = await contactDB.find().sort({ createdAt: -1 });
        res.status(200).json(contacts);
    } catch (err) {
        res.status(500).json({ response: "Server error", error: err.message });
    }
});

// Créer un formulaire de contact
router.post('/create', async (req, res) => {
    const { error, value } = contactSchema.validate(req.body);

    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const newContact = new contactDB(value);

    try {
        await newContact.save();
        res.status(201).json({ response: "Message reçu avec succès." });
    } catch (err) {
        res.status(500).json({ response: "Erreur serveur.", error: err.message });
    }
});

// Supprimer un formulaire (admin uniquement)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;

    if (!id) {
        return res.status(400).json({ error: "ID requis" });
    }

    try {
        await contactDB.deleteOne({ _id: id });
        res.status(204).send(); // Pas de contenu, suppression réussie
    } catch (err) {
        res.status(500).json({ response: "Erreur lors de la suppression.", error: err.message });
    }
});
module.exports = router;