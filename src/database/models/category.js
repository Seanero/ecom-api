const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: /^[a-z0-9\-]+$/
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('category', categorySchema);
