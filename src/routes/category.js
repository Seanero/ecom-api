const express = require('express');
const Joi = require('joi');
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

const categorySchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    slug: Joi.string()
        .lowercase()
        .pattern(/^[a-z0-9\-]+$/)
        .required()
});

const deleteId = Joi.object({
    id: Joi.string().required(),
})

const categoryDB = require('../database/models/category');

router.get('/', (req, res) => {
    res.json({response: "API is running"});
})

router.get('/getAll', async (req, res) => {
    categoryDB.find({})
        .then(products => res.json(products))
        .catch(err => res.status(500).json({ response: 'Erreur serveur.', error: err }));
})

router.get('/get/:id', async (req, res) => {
    const id = req.params.id;
    categoryDB.findById(id)
        .then(product => res.status(200).json(product))
        .catch(err => res.status(404).json({response: "Not Found", error: err}))
})

router.post('/create', verifyToken, verifyAdmin, async (req, res) => {
    console.log(req.body);
    const { error, value } = categorySchema.validate(req.body);
    console.log(value)

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const newCategory = new categoryDB(value);
    await newCategory.save()
        .then(() => {
            res.status(201).json({response: "Category created"});
            console.log("Categoriée enregistré !");
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Erreur :", err);
        });
})

router.post('/delete', verifyToken, verifyAdmin, async (req, res) => {
    console.log(req.body);
    const { error, value } = deleteId.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    categoryDB.deleteOne({ _id: value.id })
        .then(() => {
            res.status(204);
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Error :", err);
        })

})

module.exports = router;