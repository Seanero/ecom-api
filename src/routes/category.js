const express = require('express');
const Joi = require('joi');
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

const categorySchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    description: Joi.string().min(3).max(500).required()
});

const deleteId = Joi.object({
    id: Joi.string().required(),
})

const categoryDB = require('../database/models/category');
const productDB = require("../database/models/products");

router.get('/', (req, res) => {
    res.json({response: "API is running"});
})

router.get('/getAll', async (req, res) => {
    categoryDB.find({})
        .then(category => res.json(category))
        .catch(err => res.status(500).json({ response: 'Erreur serveur.', error: err }));
})

router.get('/get/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const category = await categoryDB.findById(id);
        if (!category) {
            return res.status(404).json({ response: "NOT_FOUND" });
        }
        return res.status(200).json(category);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ response: "Invalid ID format" });
        }
        return res.status(500).json({ response: "Server error", error: err.message });
    }
});

router.post('/create', verifyToken, verifyAdmin, async (req, res) => {
    const { error, value } = categorySchema.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const newCategory = new categoryDB(value);
    await newCategory.save()
        .then(() => {
            res.status(201).json({response: "Category created"});
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Erreur :", err);
        });
})

router.post('/delete', verifyToken, verifyAdmin, async (req, res) => {
    const { error, value } = deleteId.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    categoryDB.deleteOne({ _id: value.id })
        .then(() => {
            res.status(204).send();
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Error :", err);
        })
})

router.put('/update/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;

        // Validation des données reçues
        const { error, value } = categorySchema.validate(req.body);

        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Vérification si des produits utilisent cette catégorie avant mise à jour
        const productsWithCategory = await productDB.countDocuments({ category: id });

        // Mise à jour de la catégorie
        const updatedCategory = await categoryDB.findByIdAndUpdate(
            id,
            value,
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ response: "CATEGORY_NOT_FOUND" });
        }

        return res.status(200).json({
            response: "Category updated",
            category: updatedCategory,
            productsAffected: productsWithCategory
        });

    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ response: "Invalid ID format" });
        }
        return res.status(500).json({ error: err.message || err });
    }
});

module.exports = router;