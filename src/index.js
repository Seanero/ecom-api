const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

require('./database/index');

const mainRoutes = require("./routes/index");
const productRoutes = require("./routes/product");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());


app.use("/", mainRoutes);
app.use("/product", productRoutes)

const startServer = async () => {
    app.listen(process.env.WEB_PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${process.env.WEB_PORT}`);
    });
};

startServer();