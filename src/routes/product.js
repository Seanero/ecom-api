const express = require('express');
const Joi = require('joi');
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const verifyAdmin = require("../middlewares/verifyAdmin");

const productSchema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    description: Joi.string().min(10).required(),
    price: Joi.number().min(0).required(),
    stock: Joi.number().min(0).required(),
    category: Joi.string().required(),
    images: Joi.string().min(1).required()
});

const productDB = require('../database/models/products');
const categoryDB = require('../database/models/category');


const productID = Joi.object({
    id: Joi.string().required(),
})

router.get('/', (req, res) => {
    res.json({response: "API is running"});
})

router.get('/get/:id', async (req, res) => {
    const id = req.params.id;
    productDB.findById(id)
        .then(product => res.status(200).json(product))
        .catch(err => res.status(404).json({response: "Not Found", error: err}))
})

router.get('/getAll', async (req, res) => {
    productDB.find({})
        .then(products => res.json(products))
        .catch(err => res.status(500).json({ response: 'Erreur serveur.', error: err }));
})

router.post('/create', verifyToken, verifyAdmin, async (req, res) => {
    try {
        console.log(req.body);
        const { error, value } = productSchema.validate(req.body);

        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const category = await categoryDB.findById(req.body.category);
        if (!category) {
            return res.status(404).json({ code: "CATEGORY_NOT_FOUND" });
        }

        const newProduct = new productDB(value);
        await newProduct.save();

        return res.status(201).json({ response: "Product created" });

    } catch (err) {
        return res.status(500).json({ error: err.message || err });
    }
});

router.post('/delete', verifyToken, verifyAdmin, async (req, res) => {
    const { error, value } = productID.validate(req.body);

    if(error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    productDB.deleteOne({ _id: value.id })
        .then(() => {
            res.status(204).send();
        })
        .catch((err) => {
            res.status(500).json({error: err});
        })

})

module.exports = router;