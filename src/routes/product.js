const express = require('express');
const Joi = require('joi');
const router = express.Router();

const productSchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    description: Joi.string().min(10).required(),
    price: Joi.number().min(0).required(),
    stock: Joi.number().min(0).required(),
    images: Joi.array().items(
        Joi.object({
            url: Joi.string().uri().required(),
            alt: Joi.string().allow('').optional()
        })
    ).min(1).required()
});

const deleteId = Joi.object({
    id: Joi.string().required(),
})

const productDB = require('../database/models/products');

router.get('/', (req, res) => {
    res.json({response: "API is running"});
})

router.get('/getAll', async (req, res) => {
    productDB.find({})
        .then(products => res.json(products))
        .catch(err => res.status(500).json({ error: 'Erreur serveur.' }));
})

router.post('/create', async (req, res) => {
    console.log(req.body);
    const { error, value } = productSchema.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const newProduct = new productDB(value);
    await newProduct.save()
        .then(() => {
            res.status(201).json({response: "Product created"});
            console.log("Produit enregistré !");
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Erreur :", err);
        });
})

router.post('/delete', async (req, res) => {
    console.log(req.body);
    const { error, value } = deleteId.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    productDB.deleteOne({ _id: value.id })
        .then(() => {
            res.status(204);
        })
        .catch((err) => {
            res.status(500).json({error: err});
            console.error("Error :", err);
        })

})

module.exports = router;