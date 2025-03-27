const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const mainRoutes = require("./routes/index");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());


app.use("/", mainRoutes);

const startServer = async () => {
    app.listen(process.env.WEB_PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${process.env.WEB_PORT}`);
    });
};

startServer();