const mongoose = require("mongoose");

const invoiceAddressSchema = new mongoose.Schema({
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    stateOrDepartment: { type: String, trim: true },
    country: { type: String, required: true, trim: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    lastname: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    },
    password: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 200
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    invoiceAddress: {
        type: invoiceAddressSchema,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('user', userSchema);
