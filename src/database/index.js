const mongoose = require("mongoose");

mongoose.connect(process.env.MONGODB_LINK)
    .then(() => {
        console.log("[DATABASE] Connexion a la BDD réussie !")
    })
    .catch((error) => {
        console.error("Erreur lors de la connexion :", error)
        process.exit(1);
    })