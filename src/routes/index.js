const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({response: "API is running"});
})

module.exports = router;