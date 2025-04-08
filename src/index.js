const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

require('./database/index');

const mainRoutes = require("./routes/index");
const productRoutes = require("./routes/product");
const categoryRoutes = require("./routes/category");
const userRoutes = require("./routes/user");
const contactRoutes = require("./routes/contact");


const app = express();

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors({
    origin: 'http://localhost:5173', // Remplacez par l'URL exacte de votre frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use("/", mainRoutes);
app.use("/product", productRoutes);
app.use("/category", categoryRoutes);
app.use("/users", userRoutes);
app.use("/contact", contactRoutes);

const startServer = async () => {
    app.listen(process.env.WEB_PORT, () => {
        console.log(`Serveur lancé sur http://localhost:${process.env.WEB_PORT}`);
    });
};

startServer();